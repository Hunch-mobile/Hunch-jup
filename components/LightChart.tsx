import { CandleData } from '@/lib/types';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

interface LightChartProps {
    candles: CandleData[];
    width: number;
    height: number;
    isYes?: boolean; // true = green, false = red
}

/**
 * LightChart - A lightweight, non-interactive chart for social feed
 * No animations, no touch handlers - maximizes performance
 */
export const LightChart: React.FC<LightChartProps> = ({
    candles,
    width,
    height,
    isYes = true,
}) => {
    // Process candle data - memoized for performance
    const chartData = useMemo(() => {
        if (!candles || candles.length === 0) {
            return { path: '', areaPath: '', lastPoint: null };
        }

        // Take last 20 candles
        const recentCandles = candles.slice(-20);
        const prices = recentCandles.map(c => c.close);

        if (prices.length === 0) {
            return { path: '', areaPath: '', lastPoint: null };
        }

        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice || 0.01;

        // Padding for chart
        const paddingY = height * 0.15;
        const paddingRight = 12; // Space for dot
        const chartHeight = height - paddingY * 2;
        const chartWidth = width - paddingRight;

        // Generate points
        const points = prices.map((price, index) => {
            const x = (index / (prices.length - 1)) * chartWidth;
            const y = paddingY + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
            return { x, y };
        });

        // Create bezier curve path
        let path = '';
        let areaPath = '';

        if (points.length > 0) {
            path = `M ${points[0].x} ${points[0].y}`;
            areaPath = `M ${points[0].x} ${height}`;
            areaPath += ` L ${points[0].x} ${points[0].y}`;

            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                const cpx = (prev.x + curr.x) / 2;
                path += ` Q ${cpx} ${prev.y} ${cpx} ${(prev.y + curr.y) / 2}`;
                path += ` Q ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
                areaPath += ` Q ${cpx} ${prev.y} ${cpx} ${(prev.y + curr.y) / 2}`;
                areaPath += ` Q ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
            }

            areaPath += ` L ${points[points.length - 1].x} ${height}`;
            areaPath += ' Z';
        }

        const lastPoint = points[points.length - 1];
        return { path, areaPath, lastPoint };
    }, [candles, width, height]);

    // Colors based on trade side
    const lineColor = isYes ? '#22c55e' : '#ef4444'; // green for YES, red for NO
    const gradientId = `light-gradient-${isYes ? 'yes' : 'no'}`;

    // Render placeholder if no data
    if (!candles || candles.length === 0 || !chartData.path) {
        return (
            <View style={[styles.container, { width, height }]}>
                <View style={styles.placeholder}>
                    <View style={[styles.placeholderLine, { backgroundColor: lineColor }]} />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { width, height }]}>
            <Svg width={width} height={height} style={styles.svg}>
                <Defs>
                    <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                        <Stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                    </LinearGradient>
                </Defs>

                {/* Area fill */}
                <Path
                    d={chartData.areaPath}
                    fill={`url(#${gradientId})`}
                />

                {/* Main line */}
                <Path
                    d={chartData.path}
                    stroke={lineColor}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Static dot at end */}
                {chartData.lastPoint && (
                    <Circle
                        cx={chartData.lastPoint.x}
                        cy={chartData.lastPoint.y}
                        r={4}
                        fill={lineColor}
                        stroke="#FFFFFF"
                        strokeWidth={1.5}
                    />
                )}
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        borderRadius: 8,
        position: 'relative',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
    },
    svg: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderLine: {
        width: '80%',
        height: 2,
        borderRadius: 1,
        opacity: 0.3,
    },
});

export default LightChart;
