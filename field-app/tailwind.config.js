/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "#F5F5F0",
        canvas: "#F7F4EF",
        card: "#FFFFFF",
        sunken: "#EDE9E3",
        ink: "#1C1410",
        soil: {
          DEFAULT: "#1C1410",
          2: "#2E2218",
          3: "#4A3828",
        },
        warm: {
          DEFAULT: "#8C7B6B",
          dark: "#4A3828",
          muted: "#B4A898",
        },
        lime: {
          DEFAULT: "#D4FF4F",
          hover: "#C8F244",
        },
        login: "#0a0a0a",
      },
      fontFamily: {
        display: ["Georgia", "Times New Roman", "serif"],
        body: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
      },
    },
  },
  plugins: [],
};
