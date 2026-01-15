/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,jsx,ts,tsx}",
        "./components/**/*.{js,jsx,ts,tsx}",
    ],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                // App theme colors
                app: {
                    bg: '#FFFFFF',
                    card: '#FAFAFA',
                    elevated: '#F5F5F5',
                    dark: '#000000',
                },
                border: {
                    DEFAULT: '#E5E5E5',
                    light: '#F0F0F0',
                    dark: '#D0D0D0',
                },
                txt: {
                    primary: '#000000',
                    secondary: '#666666',
                    disabled: '#999999',
                    inverse: '#FFFFFF',
                },
                status: {
                    success: '#000000',
                    error: '#DC2626',
                    warning: '#666666',
                },
                chart: {
                    positive: '#FFD93D',
                    negative: '#FF6B9D',
                    neutral: '#A855F7',
                    line: '#F97316',
                    dot: '#FBBF24',
                },
            },
        },
    },
    plugins: [],
}
