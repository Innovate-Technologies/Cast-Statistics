import rest from "restler"
const CronJob = require("cron").CronJob;

export default async (info) => {

    const listenerPromisesPerStream = {}

    const getListenerUID = (listenerInfo) => new Promise((resolve) => {
        rest.postJson(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/create-session`, listenerInfo, {
            timeout: 100000,
        }).on("complete", function (body, response) {
            if (response.statusCode === 200 || response.statusCode === 204) {
                return resolve(body)
            }
            this.retry(2000)
        }).on("timeout", function () {
            this.retry(2000)
        })
    })

    const closeListenerSession = (listenerInfo) => {
        if (listenerInfo && listenerInfo.id && listenerPromisesPerStream[listenerInfo.stream] && listenerPromisesPerStream[listenerInfo.stream][listenerInfo.id]) {
            listenerPromisesPerStream[listenerInfo.stream][listenerInfo.id].then(({ uid }) => {
                if (!uid) {
                    return
                }
                rest.postJson(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/close-session`, { uid }, {
                    timeout: 100000,
                }).on("complete", function (body, response) {
                    if (response.statusCode !== 200 && response.statusCode !== 204) {
                        return this.retry(2000)
                    }
                    delete listenerPromisesPerStream[listenerInfo.stream][listenerInfo.id]
                }).on("timeout", function () {
                    this.retry(2000)
                })
            })
        } else {
            console.log(listenerInfo)
            console.log(listenerPromisesPerStream[listenerInfo.stream])
        }
    }

    const closeAllSessions = () => new Promise((resolve) => {
        rest.post(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/close-all-sessions`, {
            timeout: 100000,
        }).on("complete", function (body, response) {
            if (response.statusCode === 200 || response.statusCode === 204) {
                return resolve(body)
            }
            this.retry(2000)
        }).on("timeout", function () {
            this.retry(2000)
        })
    })

    await closeAllSessions()

    events.on("listenerTunedIn", (listenerInfo) => {
        if (!listenerInfo) {
            return;
        }
        try {
            if (!listenerPromisesPerStream[listenerInfo.stream]) {
                listenerPromisesPerStream[listenerInfo.stream] = {}
            }
            listenerPromisesPerStream[listenerInfo.stream][listenerInfo.id] = getListenerUID(listenerInfo)
        } catch (error) {
            console.log(error)
        }
    })
    events.on("listenerTunedOut", closeListenerSession)

    const postStatus = (streaminfo) => {
        rest.postJson(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/store-status`, streaminfo, {
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

    const reportStatus = () => {
        for (let stream of global.streams.getActiveStreams()) {
            postStatus({
                username: info.username,
                listenerCount: global.streams.getListeners(stream).length,
                stream,
            })
        }
    }

    new CronJob({
        cronTime: "0 * * * * *",
        onTick: reportStatus,
        start: true,
    })

}
