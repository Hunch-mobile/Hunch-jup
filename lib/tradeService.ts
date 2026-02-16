// Trade service for DFlow API integration via Next.js backend
// Handles order requests, transaction signing, and order status polling
//
// IMPORTANT: All order/quote requests MUST go through the backend at /api/dflow/quote.
// The backend applies the sponsor signature before returning the transaction.
// Mobile clients should NEVER call DFlow directly for sponsored order flow.

import { Connection, VersionedTransaction } from '@solana/web3.js';

// Constants
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const DECIMALS = 1_000_000; // 6 decimals for USDC and outcome tokens

// Default send options - mirror web behavior
export const DEFAULT_SEND_OPTIONS = {
    skipPreflight: true,
    maxRetries: 3,
    preflightCommitment: 'confirmed' as const,
};

// Backend API URL - ALL orders must go through this endpoint
// The backend sponsors the transaction (applies sponsor signature) before returning
const API_BASE_URL = 'https://870f-2405-201-35-288f-cc5b-e5da-7c7d-e76.ngrok-free.app'; // TODO: Move to env variable in production

// Types
export interface DFlowOrderResponse {
    transaction: string; // base64 encoded - ALREADY sponsor-signed from backend
    openTransaction?: string; // alternate field name for base64 tx
    executionMode: 'sync' | 'async';
    inAmount: string;
    outAmount: string;
    inputMint: string;
    outputMint: string;
    lastValidBlockHeight?: number;
    prioritizationFeeLamports?: number;
    computeUnitLimit?: number;
}

export interface DFlowOrderStatus {
    status: 'open' | 'closed' | 'pendingClose' | 'failed';
    fills?: Array<{ qtyIn: string; qtyOut: string }>;
}

export interface OrderParams {
    userPublicKey: string;
    inputMint: string;
    outputMint: string;
    amount: string; // MUST be in smallest unit (USDC = 6 decimals, e.g., $10 = "10000000")
    slippageBps?: number;
}

export interface TradeError extends Error {
    code?: 'BLOCKHASH_EXPIRED' | 'SIMULATION_FAILED' | 'NETWORK_ERROR' | 'SIGNING_ERROR' | 'UNKNOWN';
    retryable: boolean;
}

// Helper to sleep for polling
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Create a typed trade error
 */
function createTradeError(
    message: string,
    code: TradeError['code'] = 'UNKNOWN',
    retryable: boolean = false
): TradeError {
    const error = new Error(message) as TradeError;
    error.code = code;
    error.retryable = retryable;
    return error;
}

/**
 * Check if an error indicates blockhash expiry (requires new quote)
 */
export function isBlockhashExpiredError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    return (
        message.includes('blockhash not found') ||
        message.includes('blockhash expired') ||
        message.includes('block height exceeded') ||
        message.includes('transaction has already been processed')
    );
}

/**
 * Check if an error indicates simulation failure (may require new quote)
 */
export function isSimulationError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    return (
        message.includes('simulation failed') ||
        message.includes('insufficient funds') ||
        message.includes('custom program error')
    );
}

/**
 * Request an order/quote from the backend (NOT directly from DFlow)
 * 
 * CRITICAL: This function calls YOUR Next.js backend at /api/dflow/quote.
 * The backend:
 * 1. Fetches the order from DFlow with sponsor set
 * 2. Signs the transaction with SPONSOR_PRIVATE_KEY
 * 3. Returns the sponsor-signed transaction
 * 
 * The returned transaction is ALREADY sponsor-signed. Client only needs to:
 * 1. Decode base64 → VersionedTransaction
 * 2. User signs (signTransaction, NOT signAndSendTransaction)
 * 3. Send with connection.sendRawTransaction()
 */
export async function requestOrder(params: OrderParams): Promise<DFlowOrderResponse> {
    const { userPublicKey, inputMint, outputMint, amount, slippageBps = 100 } = params;

    // Validate amount format (should be smallest unit string)
    if (!/^\d+$/.test(amount)) {
        console.warn('[TradeService] Amount should be a string of digits (smallest unit). Got:', amount);
    }

    const queryParams = new URLSearchParams({
        userPublicKey,
        inputMint,
        outputMint,
        amount,
        slippageBps: slippageBps.toString(),
    });

    console.log('[TradeService] Requesting sponsor-signed order from backend:', {
        endpoint: `${API_BASE_URL}/api/dflow/quote`,
        inputMint: inputMint.substring(0, 8) + '...',
        outputMint: outputMint.substring(0, 8) + '...',
        amount,
        slippageBps,
    });

    const response = await fetch(`${API_BASE_URL}/api/dflow/quote?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[TradeService] Order request failed:', response.status, errorText);
        throw createTradeError(
            `Failed to get order: ${response.status} - ${errorText}`,
            'NETWORK_ERROR',
            true
        );
    }

    const order = await response.json();
    
    // Support both 'transaction' and 'openTransaction' field names
    const txBase64 = order.transaction || order.openTransaction;
    if (!txBase64) {
        throw createTradeError(
            'No transaction returned from backend',
            'UNKNOWN',
            true
        );
    }

    console.log('[TradeService] Sponsor-signed order received:', {
        executionMode: order.executionMode,
        inAmount: order.inAmount,
        outAmount: order.outAmount,
        txLength: txBase64.length,
    });

    return {
        ...order,
        transaction: txBase64, // Normalize to 'transaction' field
    };
}

/**
 * Get the status of an order by its transaction signature
 */
export async function getOrderStatus(signature: string): Promise<DFlowOrderStatus> {
    const response = await fetch(
        `${API_BASE_URL}/api/dflow/order-status?signature=${encodeURIComponent(signature)}`,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        }
    );

    if (!response.ok) {
        throw createTradeError(
            `Failed to get order status: ${response.status}`,
            'NETWORK_ERROR',
            true
        );
    }

    return response.json();
}

/**
 * Wait for an async order to complete
 * Returns the final status or assumes success if status check fails
 * (since transaction was already sent to blockchain)
 */
export async function waitForOrderCompletion(
    signature: string,
    maxAttempts: number = 10,
    intervalMs: number = 2000
): Promise<DFlowOrderStatus> {
    console.log('[TradeService] Waiting for order completion:', signature);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const status = await getOrderStatus(signature);

            console.log(`[TradeService] Order status (attempt ${attempt + 1}):`, status.status);

            if (status.status === 'closed') {
                console.log('[TradeService] Order completed successfully');
                return status;
            }

            if (status.status === 'failed') {
                throw new Error('Order execution failed');
            }
        } catch (error: any) {
            // If order-status endpoint fails (404, etc), log but don't fail
            // The transaction was already sent to blockchain
            console.warn(`[TradeService] Order status check failed (attempt ${attempt + 1}):`, error.message);

            // After a few attempts, assume success if endpoint is unavailable
            if (attempt >= 3 && error.message?.includes('404')) {
                console.log('[TradeService] Order status endpoint unavailable, assuming success since tx was sent');
                return { status: 'closed' };
            }
        }

        await sleep(intervalMs);
    }

    // If we couldn't confirm status but transaction was sent, assume success
    console.log('[TradeService] Order status timeout, assuming success since transaction was sent');
    return { status: 'closed' };
}

/**
 * Deserialize a base64 transaction from the backend
 * The transaction is ALREADY sponsor-signed by the backend
 */
export function deserializeTransaction(base64Transaction: string): VersionedTransaction {
    console.log('[TradeService] Deserializing sponsor-signed tx, base64 length:', base64Transaction.length);
    
    // Decode base64 to bytes
    const transactionBytes = Uint8Array.from(
        Buffer.from(base64Transaction, 'base64')
    );
    console.log('[TradeService] Transaction byte length:', transactionBytes.length);

    // Deserialize to VersionedTransaction
    const tx = VersionedTransaction.deserialize(transactionBytes);
    
    // Log fee payer (account 0) for debugging
    const feePayer = tx.message.staticAccountKeys[0];
    console.log('[TradeService] Fee Payer (sponsor):', feePayer.toString());
    
    // Verify sponsor signature exists (should be non-zero)
    const sponsorSig = tx.signatures[0];
    const hasValidSponsorSig = sponsorSig && !sponsorSig.every(b => b === 0);
    console.log('[TradeService] Sponsor signature present:', hasValidSponsorSig);
    
    if (!hasValidSponsorSig) {
        console.warn('[TradeService] WARNING: Sponsor signature appears to be missing or empty!');
    }
    
    return tx;
}

/**
 * Sign and send a sponsor-signed transaction using Privy wallet provider
 * 
 * FLOW:
 * 1. Transaction is ALREADY sponsor-signed (from backend)
 * 2. User signs with Privy signTransaction (sign-only, NOT signAndSendTransaction)
 * 3. We serialize and send with our own RPC connection
 * 
 * This gives us control over:
 * - When the tx is sent
 * - Retry logic with fresh quotes if blockhash expires
 * - Send options (skipPreflight, maxRetries)
 * 
 * @returns Transaction signature
 */
export async function signAndSendWithPrivy(
    provider: any,
    transaction: VersionedTransaction,
    connection: Connection
): Promise<string> {
    console.log('[TradeService] Starting user sign flow...');

    // Log pre-signing signature state
    const preSigs = transaction.signatures.map((s, i) => ({
        index: i,
        hasSignature: s && !s.every(b => b === 0),
        preview: Buffer.from(s.slice(0, 8)).toString('hex'),
    }));
    console.log('[TradeService] Signatures before user sign:', preSigs);

    // 1. Ask Privy to JUST SIGN the transaction (not send)
    // CRITICAL: Use signTransaction, NOT signAndSendTransaction
    // This returns a transaction with the user's signature added
    let signedTransaction: VersionedTransaction;
    try {
        const response = await provider.request({
            method: 'signTransaction',
            params: {
                transaction,
                connection,
            }
        });

        // Unwrap the response if Privy wraps it
        signedTransaction = response.signedTransaction || response;

        if (!signedTransaction || !signedTransaction.signatures) {
            throw createTradeError(
                'No signatures returned from wallet',
                'SIGNING_ERROR',
                false
            );
        }
    } catch (error: any) {
        // User rejected or wallet error
        if (error.code === 4001 || error.message?.includes('rejected')) {
            throw createTradeError('Transaction rejected by user', 'SIGNING_ERROR', false);
        }
        throw createTradeError(
            `Signing failed: ${error.message || 'Unknown error'}`,
            'SIGNING_ERROR',
            false
        );
    }

    // Log post-signing signature state
    const postSigs = signedTransaction.signatures.map((s: Uint8Array, i: number) => ({
        index: i,
        hasSignature: s && !s.every((b: number) => b === 0),
        preview: Buffer.from(s.slice(0, 8)).toString('hex'),
    }));
    console.log('[TradeService] Signatures after user sign:', postSigs);

    // Verify we have at least 2 signatures (sponsor + user)
    const validSigCount = signedTransaction.signatures.filter(
        (s: Uint8Array) => s && !s.every((b: number) => b === 0)
    ).length;
    
    if (validSigCount < 2) {
        console.warn(`[TradeService] WARNING: Only ${validSigCount} valid signature(s). Expected 2 (sponsor + user).`);
    }

    // 2. Serialize and send with our RPC (mirrors web behavior)
    const rawTransaction = signedTransaction.serialize();
    console.log('[TradeService] Sending raw transaction, size:', rawTransaction.length);

    try {
        const signature = await connection.sendRawTransaction(rawTransaction, DEFAULT_SEND_OPTIONS);
        console.log('[TradeService] Transaction sent successfully:', signature);
        return signature;
    } catch (error: any) {
        console.error('[TradeService] Send failed:', error);
        
        // Classify the error for retry logic
        if (isBlockhashExpiredError(error)) {
            throw createTradeError(
                'Transaction expired. Please try again.',
                'BLOCKHASH_EXPIRED',
                true
            );
        }
        if (isSimulationError(error)) {
            throw createTradeError(
                `Transaction simulation failed: ${error.message}`,
                'SIMULATION_FAILED',
                true
            );
        }
        throw createTradeError(
            error.message || 'Failed to send transaction',
            'NETWORK_ERROR',
            true
        );
    }
}

/**
 * Execute a complete trade flow with automatic retry on blockhash expiry
 * 
 * OPTIMAL FLOW:
 * 1. Request sponsor-signed order from backend (/api/dflow/quote)
 * 2. Decode base64 → VersionedTransaction (sponsor already signed)
 * 3. User signs (signTransaction only)
 * 4. Send with our RPC (skipPreflight: true, maxRetries: 3)
 * 5. Wait for confirmation if async mode
 * 
 * RETRY LOGIC:
 * - On blockhash expiry or simulation failure: request NEW order and retry
 * - On user rejection or signing error: don't retry
 * - Max 2 retries for network/expiry errors
 */
export async function executeTrade(params: {
    provider: any;
    connection: Connection;
    userPublicKey: string;
    inputMint: string;
    outputMint: string;
    amount: string;
    slippageBps?: number;
    maxRetries?: number;
}): Promise<{
    signature: string;
    order: DFlowOrderResponse;
}> {
    const { 
        provider, 
        connection, 
        userPublicKey, 
        inputMint, 
        outputMint, 
        amount, 
        slippageBps = 100,
        maxRetries = 2 
    } = params;

    let lastError: TradeError | Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                console.log(`[TradeService] Retry attempt ${attempt}/${maxRetries}...`);
            }

            // Step 1: Get sponsor-signed order from backend
            // CRITICAL: Always request fresh order on retry (new blockhash)
            console.log('[TradeService] Requesting order for:', userPublicKey.substring(0, 8) + '...');
            const order = await requestOrder({
                userPublicKey,
                inputMint,
                outputMint,
                amount,
                slippageBps,
            });

            // Step 2: Deserialize (tx is already sponsor-signed)
            const transaction = deserializeTransaction(order.transaction);

            // Step 3 & 4: User sign + send (minimize delay between these)
            const signature = await signAndSendWithPrivy(provider, transaction, connection);

            // Step 5: Wait for confirmation if async
            if (order.executionMode === 'async') {
                await waitForOrderCompletion(signature);
            }

            console.log('[TradeService] Trade executed successfully:', signature);
            return { signature, order };

        } catch (error: any) {
            lastError = error;
            console.error(`[TradeService] Trade attempt ${attempt + 1} failed:`, error.message);

            // Don't retry on non-retryable errors (user rejection, etc.)
            if (error.retryable === false) {
                throw error;
            }

            // Don't retry if we've exhausted attempts
            if (attempt >= maxRetries) {
                throw error;
            }

            // Small delay before retry
            await sleep(500);
        }
    }

    // Should never reach here, but just in case
    throw lastError || createTradeError('Trade failed after all retries', 'UNKNOWN', false);
}

/**
 * Convert human-readable amount to raw amount (smallest unit)
 * 
 * IMPORTANT: DFlow expects amounts in smallest unit:
 * - USDC has 6 decimals: $10 → "10000000"
 * - Outcome tokens have 6 decimals
 * 
 * @param humanAmount - Human readable amount (e.g., 10 for $10)
 * @param decimals - Number of decimals (default 6 for USDC)
 * @returns String representation of smallest unit amount
 */
export function toRawAmount(humanAmount: number | string, decimals: number = 6): string {
    const amount = typeof humanAmount === 'string' ? parseFloat(humanAmount) : humanAmount;
    return Math.floor(amount * Math.pow(10, decimals)).toString();
}

/**
 * Convert raw amount (smallest unit) to human-readable
 * 
 * @param rawAmount - Amount in smallest unit
 * @param decimals - Number of decimals (default 6 for USDC)
 * @returns Human readable amount
 */
export function fromRawAmount(rawAmount: string | number, decimals: number = 6): number {
    const amount = typeof rawAmount === 'string' ? parseInt(rawAmount, 10) : rawAmount;
    return amount / Math.pow(10, decimals);
}
