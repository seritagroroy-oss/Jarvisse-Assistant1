/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./client/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jarvis: {
          blue: "#3b82f6",
          dark: "#05060f",
          card: "rgba(17, 24, 39, 0.7)",
        },
      },
    },
  },
  plugins: [],
}
