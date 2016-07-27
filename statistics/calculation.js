import rest from "restler"
import _ from "underscore"

const countListeners = (sessions) => {
    return _.groupBy(sessions, "uid")
}

const countClients = (sessions) => {
    const clients = {}
    const sessionsByClient = _.groupBy(sessions, "client")
    for (let client in sessionsByClient) {
        if (sessionsByClient.hasOwnProperty(client)) {
            clients[client] = sessionsByClient[client].length
        }
    }
    return clients
}

const countCountries = (sessions) => {
    const clients = {}
    const sessionsByClient = _.groupBy(sessions, "country")
    for (let client in sessionsByClient) {
        if (sessionsByClient.hasOwnProperty(client)) {
            clients[client] = sessionsByClient[client].length
        }
    }
    return clients
}

const calculateTLH = (sessions) => {
    let totalSeconds = 0
    for (let session of sessions) {
        if (!session.endTime) {
            session.endTime = Math.floor(new Date().getTime() / 1000)
        }
        totalSeconds += session.endTime - session.startTime
    }
    return totalSeconds / 60 / 60 // seconds to hour
}

const calculateAverageSessionTime = (sessions) => {
    let totalSeconds = 0
    for (let session of sessions) {
        if (!session.endTime) {
            session.endTime = Math.floor(new Date().getTime() / 1000)
        }
        totalSeconds += session.endTime - session.startTime
    }

    return totalSeconds / sessions.length
}

export default (info) => {
    const calculateLastMinute = () => {
        rest.get(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/get-last-minute-sessions`)
        .on("complete", (sessions) => {
            countListeners(sessions)
            countClients(sessions)
            if (config.geoservices && config.geoservices.enabled) {
                countCountries(sessions)
            }
        })
    }

    setInterval(calculateLastMinute, 60 * 1000)
}
