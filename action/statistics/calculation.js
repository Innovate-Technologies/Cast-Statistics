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

const calculateTLH = (sessions, startTime, endTime) => {
    let totalMilliSeconds = 0
    for (let session of sessions) {
        session.startTime = new Date(session.startTime)
        if (session.startTime < startTime) {
            session.startTime = startTime
        }
        if (!session.endTime) {
            session.endTime = endTime
        } else {
            session.endTime = new Date(session.endTime)
        }
        totalMilliSeconds += session.endTime.getTime() - session.startTime.getTime()
    }
    return totalMilliSeconds / 60 / 60 / 1000 // milliseconds to hour
}

const calculateAverageSessionTime = (sessions, startTime, endTime) => {
    let totalMilliSeconds = 0
    let usefulSessions = 0
    for (let session of sessions) {
        session.startTime = new Date(session.startTime)
        if (session.startTime < startTime) {
            session.startTime = startTime
        }
        if (!session.endTime) {
            session.endTime = endTime
        } else {
            session.endTime = new Date(session.endTime)
        }
        const diffTime = session.endTime.getTime() - session.startTime.getTime()
        if (diffTime > 5 ) { // Under 5 seconds is't a real session
            usefulSessions++
            totalMilliSeconds += session.endTime.getTime() - session.startTime.getTime()
        }
    }
    return (totalMilliSeconds / 1000) / usefulSessions
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
                storeInfo({ resolution: "minute", totalSessions: sessions.length, uniqueListeners: Object.keys(uniqueListeners).length, clientCount, countryList, returningListeners: returningListeners.length })
            })
    }

    const calculateLastHour = () => {
        const startTime = new Date((new Date()).getTime() - ONE_HOUR)
        const endTime = new Date()
        rest.get(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/get-all-sessions-for-period/${startTime.toJSON()}/${endTime.toJSON()}`)
            .on("complete", (sessions) => {
                let countryList = null;
                const uniqueListeners = groupUniqueListeners(sessions)
                const clientCount = countClients(sessions)
                const returningListeners = countReturningListeners(sessions)
                const tlh = calculateTLH(sessions, startTime, endTime)
                const averageSessionTime = calculateAverageSessionTime(sessions, startTime, endTime)
                if (config.geoservices && config.geoservices.enabled) {
                    countryList = countCountries(sessions)
                }
                storeInfo({ resolution: "hour", totalSessions: sessions.length, uniqueListeners: Object.keys(uniqueListeners).length, clientCount, countryList, returningListeners: returningListeners.length, tlh, averageSessionTime })
            })
    }

    const calculateLastDay = () => {
        const startTime = new Date((new Date()).getTime() - ONE_DAY)
        const endTime = new Date()
        rest.get(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/get-all-sessions-for-period/${startTime.toJSON()}/${endTime.toJSON()}`)
            .on("complete", (sessions) => {
                let countryList = null;
                const uniqueListeners = groupUniqueListeners(sessions)
                const clientCount = countClients(sessions)
                const returningListeners = countReturningListeners(sessions)
                const tlh = calculateTLH(sessions, startTime, endTime)
                const averageSessionTime = calculateAverageSessionTime(sessions, startTime, endTime)
                if (config.geoservices && config.geoservices.enabled) {
                    countryList = countCountries(sessions)
                }
                storeInfo({ resolution: "day", totalSessions: sessions.length, uniqueListeners: Object.keys(uniqueListeners).length, clientCount, countryList, returningListeners: returningListeners.length, tlh, averageSessionTime })
            })
    }
    const storeInfo = ({resolution, totalSessions, uniqueListeners, clientCount, averageListeners, tlh, averageSessionTime, countryList, returningListeners }) => {
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
            resolution,
            totalSessions,
            uniqueListeners,
            averageListeners,
            tlh,
            averageSessionTime,
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
    new CronJob({
        cronTime: "0 0 * * * *",
        onTick: calculateLastHour,
        start: true,
    })
    new CronJob({
        cronTime: "0 0 0 * * *",
        onTick: calculateLastDay,
        start: true,
    })
}
