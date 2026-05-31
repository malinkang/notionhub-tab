const daisyui = require("daisyui")

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [
        daisyui,
    ],
    daisyui: {
        themes: ["light", "dark"],
        darkTheme: "dark"
    }
}
