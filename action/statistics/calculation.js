import rest from "restler"
import _ from "underscore"
import { format } from "path";
const CronJob = require("cron").CronJob;

const ONE_SECOND = 1000
const ONE_MINUTE = 60 * ONE_SECOND
const ONE_HOUR = 60 * ONE_MINUTE
const ONE_DAY = 24 * ONE_HOUR

const getData = (url) => new Promise((resolve, reject) => {
    let r = 0;
    rest.get(url, { timeout: 10000 }).on("complete", function (data, response) {
        if (response && (response.statusCode === 200 || response.statusCode === 204)) {
            return resolve(data)
        }
        if (response && response.statusCode < 500) {
            return reject(data)
        }
        r++
        this.retry(2000^r)
    }).on("timeout", function () {
        r++;
        this.retry(2000^r)
    })
})

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
    let total= 0
    for (let session of sessions) {
        session.startTime = new Date(session.startTime)
        if (session.startTime.getTime() < startTime.getTime()) {
            session.startTime = startTime
        }
        if (!session.endTime) {
            session.endTime = endTime
        } else {
            session.endTime = new Date(session.endTime)
        }
        
        let total = session.endTime.getTime() - session.startTime.getTime()
        total /= 1000 // seconds
        total /= 60 // minutes
        total /= 60 // hours
        if (total < 0) {
            // negative?
            continue
        }

        total+= total
    }
    return total
}

const calculateAverageSessionTime = (sessions, startTime, endTime) => {
    let totalMilliSeconds = 0
    let usefulSessions = 0
    for (let session of sessions) {
        session.startTime = new Date(session.startTime)
        if (session.startTime.getTime() < startTime.getTime()) {
            session.startTime = startTime
        }
        if (!session.endTime) {
            session.endTime = endTime
        } else {
            session.endTime = new Date(session.endTime)
        }
        const diffTime = session.endTime.getTime() - session.startTime.getTime()
        if (diffTime > 5) { // Under 5 seconds is't a real session
            usefulSessions++
            totalMilliSeconds += session.endTime.getTime() - session.startTime.getTime()
        }
    }
    return (totalMilliSeconds / 1000) / usefulSessions
}

const calculateUsefulListenersCount = (sessions) => {
    let count = 0;
    for (let session of sessions) {
        session.startTime = new Date(session.startTime)
        if (!session.endTime) {
            session.endTime = new Date()
        } else {
            session.endTime = new Date(session.endTime)
        }
        const diffTime = session.endTime.getTime() - session.startTime.getTime()
        if (diffTime > 5) { // Under 5 seconds is't a real session
            count++
        }
    }
    return count
}

const calculateAverageListeners = (statuses) => {
    const statusesByStream = _.groupBy(statuses, "stream")
    let average = 0
    for (let stream in statusesByStream) {
        if (statusesByStream.hasOwnProperty(stream)) {
            let total = 0
            for (let status of statusesByStream[stream]) {
                total += status.listenerCount
            }
            average += total / statusesByStream[stream].length
        }
    }
    return average
}

export default (info) => {
    const calculateLastMinute = async () => {
        const sessions = await getData(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/get-all-sessions-for-period/${(new Date((new Date()).getTime() - ONE_MINUTE)).toJSON()}/${(new Date()).toJSON()}`)
        const statuses = await getData(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/get-statuses-for-period/${(new Date((new Date()).getTime() - ONE_MINUTE)).toJSON()}/${(new Date()).toJSON()}`)

        const averageListeners = calculateAverageListeners(statuses)
        let countryList = null;
        const uniqueListeners = groupUniqueListeners(sessions)
        const clientCount = countClients(sessions)
        const returningListeners = countReturningListeners(sessions)
        if (config.geoservices && config.geoservices.enabled) {
            countryList = countCountries(sessions)
        }
        storeInfo({ resolution: "minute", totalSessions: sessions.length, uniqueListeners: Object.keys(uniqueListeners).length, clientCount, countryList, returningListeners: returningListeners.length, usefulSessions: calculateUsefulListenersCount(sessions), averageListeners })
    }

    const calculateLastHour = async () => {
        const startTime = new Date((new Date()).getTime() - ONE_HOUR)
        const endTime = new Date()
        const sessions = await getData(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/get-all-sessions-for-period/${startTime.toJSON()}/${endTime.toJSON()}`)
        const statuses = await getData(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/get-statuses-for-period/${startTime.toJSON()}/${endTime.toJSON()}`)

        const averageListeners = calculateAverageListeners(statuses)
        let countryList = null;
        const uniqueListeners = groupUniqueListeners(sessions)
        const clientCount = countClients(sessions)
        const returningListeners = countReturningListeners(sessions)
        const tlh = calculateTLH(sessions, startTime, endTime)
        const averageSessionTime = calculateAverageSessionTime(sessions, startTime, endTime)
        if (config.geoservices && config.geoservices.enabled) {
            countryList = countCountries(sessions)
        }
        storeInfo({ resolution: "hour", totalSessions: sessions.length, uniqueListeners: Object.keys(uniqueListeners).length, clientCount, countryList, returningListeners: returningListeners.length, tlh, averageSessionTime, usefulSessions: calculateUsefulListenersCount(sessions), averageListeners })

    }

    const calculateLastDay = async () => {
        const startTime = new Date((new Date()).getTime() - ONE_DAY)
        const endTime = new Date()
        const sessions = await getData(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/get-all-sessions-for-period/${startTime.toJSON()}/${endTime.toJSON()}`)
        const statuses = await getData(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/get-statuses-for-period/${startTime.toJSON()}/${endTime.toJSON()}`)

        const averageListeners = calculateAverageListeners(statuses)
        let countryList = null;
        const uniqueListeners = groupUniqueListeners(sessions)
        const clientCount = countClients(sessions)
        const returningListeners = countReturningListeners(sessions)
        const tlh = calculateTLH(sessions, startTime, endTime)
        const averageSessionTime = calculateAverageSessionTime(sessions, startTime, endTime)
        if (config.geoservices && config.geoservices.enabled) {
            countryList = countCountries(sessions)
        }
        storeInfo({ resolution: "day", totalSessions: sessions.length, uniqueListeners: Object.keys(uniqueListeners).length, clientCount, countryList, returningListeners: returningListeners.length, tlh, averageSessionTime, usefulSessions: calculateUsefulListenersCount(sessions), averageListeners })

    }
    const storeInfo = ({resolution, totalSessions, uniqueListeners, clientCount, averageListeners, tlh, averageSessionTime, countryList, returningListeners, usefulSessions }) => {
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
            usefulSessions,
        }
        let r = 0;
        rest.postJson(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/store-calculated-info/`, storageObject, {
            timeout: 100000,
        }).on("complete", function (body, response) {
            if (response && (response.statusCode === 200 || response.statusCode === 204)) {
                return
            }
            if (response && response.statusCode < 500) {
                return
            }
            r++
            this.retry(2000^r)
        }).on("timeout", function () {
            r++
            this.retry(2000^r)
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
