import rest from "restler"
import _ from "underscore"
const CronJob = require("cron").CronJob;

const ONE_SECOND = 1000
const ONE_MINUTE = 60 * ONE_SECOND
const ONE_HOUR = 60 * ONE_MINUTE
const ONE_DAY = 24 * ONE_HOUR

const groupUniqueListeners = (sessions) => {
    return _.groupBy(sessions, (session) => { return session.listenerId._id })
}

const countReturningListeners = (sessions) => {
    return _.where(sessions, { isReturningListener: true })
}

const countClients = (sessions) => {
    const clients = {}
    const sessionsByClient = _.groupBy(sessions, (session) => { return session.listenerId.client })
    for (let client in sessionsByClient) {
        if (sessionsByClient.hasOwnProperty(client)) {
            clients[client] = sessionsByClient[client].length
        }
    }
    return clients
}

const countCountries = (sessions) => {
    const clients = {}
    const sessionsByClient = _.groupBy(sessions, (session) => { return (session.listenerId.geo || {}).country })
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
        rest.get(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/get-all-sessions-for-period/${(new Date((new Date()).getTime() - ONE_MINUTE)).toJSON()}/${(new Date()).toJSON()}`)
            .on("complete", (sessions) => {
                let countryList = null;
                const uniqueListeners = groupUniqueListeners(sessions)
                const clientCount = countClients(sessions)
                const returningListeners = countReturningListeners(sessions)
                if (config.geoservices && config.geoservices.enabled) {
                    countryList = countCountries(sessions)
                }
                storeInfo({ resulution: "minute", totalSessions: sessions.length, uniqueListeners: Object.keys(uniqueListeners).length, clientCount, countryList, returningListeners: returningListeners.length })
            })
    }

    const calculateLastHour = () => {
        rest.get(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/get-all-sessions-for-period/${(new Date((new Date()).getTime() - ONE_HOUR)).toJSON()}/${(new Date()).toJSON()}`)
            .on("complete", (sessions) => {
                countListeners(sessions)
                countClients(sessions)
                calculateTLH(sessions)
                calculateAverageSessionTime(sessions)
                if (config.geoservices && config.geoservices.enabled) {
                    countCountries(sessions)
                }
            })
    }

    const calculateLastDay = () => {
        rest.get(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/get-all-sessions-for-period/${(new Date((new Date()).getTime() - ONE_DAY)).toJSON()}/${(new Date()).toJSON()}`)
            .on("complete", (sessions) => {
                countListeners(sessions)
                countClients(sessions)
                calculateTLH(sessions)
                calculateAverageSessionTime(sessions)
                if (config.geoservices && config.geoservices.enabled) {
                    countCountries(sessions)
                }
            })
    }
    const storeInfo = ({resulution, totalSessions, uniqueListeners, clientCount, averageListeners, tlh, countryList, returningListeners }) => {
        const clientSpread = []
        for (let id in clientCount) {
            if (clientCount.hasOwnProperty(id)) {
                clientSpread.push({ client: id, percentage: (clientCount[id] / totalSessions) * 100 })
            }
        }
        const geoSpread = []
        for (let id in countryList) {
            if (countryList.hasOwnProperty(id)) {
                geoSpread.push({ country: id, percentage: (countryList[id] / totalSessions) * 100 })
            }
        }

        const storageObject = {
            resulution,
            totalSessions,
            uniqueListeners,
            averageListeners,
            tlh,
            clientSpread,
            geoSpread,
            returningListeners,
        }
        rest.postJson(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/store-calculated-info/`, storageObject, {
            timeout: 100000,
        }).on("complete", function (body, response) {
            if (response.statusCode === 200 || response.statusCode === 204) {
                return
            }
            this.retry(2000)
        }).on("timeout", function () {
            this.retry(2000)
        })
    }
    new CronJob({
        cronTime: "0 * * * * *",
        onTick: calculateLastMinute,
        start: true,
    })
}
