/*
    Cast Statistics connector
*/

import statisticEvents from "./statistics/events.js"
// import statisticCalculation from "./statistics/calculation.js"

const info = {
    itframeURL: config.itframeURL || "https://itframe.innovatete.ch",
    username: config.username,
    key: config.internal.statistics.key,
}
if (info.key) {
    statisticEvents(info)
    // statisticCalculation(info)
} else {
    console.log("No statistics key has been found")
}

