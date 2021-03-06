import rest from "restler"
const CronJob = require("cron").CronJob;

const ONE_HOUR = 60 * 60 * 1000

export default async (info) => {

    const listenerPromisesPerStream = {}
    const closedListenerPromisesPerStream = {}

    const wait = (delay) => new Promise((resolve) => {
      setTimeout(function() {
        resolve();
      }, delay)
    })

    const getListenerUID = (listenerInfo) => new Promise((resolve) => {
        let r = 0
        rest.postJson(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/create-session`, listenerInfo, {
            timeout: 100000,
        }).on("complete", function (body, response) {
            if (response && (response.statusCode === 200 || response.statusCode === 204)) {
                return resolve(body)
            }
            r++
            this.retry(2000^r)
        }).on("timeout", function () {
            r++
            this.retry(2000^r)
        })
    })

    const closeListenerSession = (listenerInfo) => {
        let r = 0
        if (!listenerInfo) {
            return;
        }
        if (!closedListenerPromisesPerStream[listenerInfo.stream]) {
            closedListenerPromisesPerStream[listenerInfo.stream] = {}
        }
        closedListenerPromisesPerStream[listenerInfo.stream][listenerInfo.id] = Date.now()  

        if (listenerInfo.id && listenerPromisesPerStream[listenerInfo.stream] && listenerPromisesPerStream[listenerInfo.stream][listenerInfo.id]) {
            listenerPromisesPerStream[listenerInfo.stream][listenerInfo.id].then(({ uid }) => {
                if (!uid) {
                    return
                }
                rest.postJson(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/close-session`, { uid }, {
                    timeout: 100000,
                }).on("complete", function (body, response) {
                    if (!response || (response.statusCode !== 200 && response.statusCode !== 204)) {
                        r++
                        return this.retry(2000^r)
                    }
                    delete listenerPromisesPerStream[listenerInfo.stream][listenerInfo.id]
                }).on("timeout", function () {
                    r++
                    this.retry(2000^r)
                })
            })
        } else {
            console.log(listenerInfo)
            console.log(listenerPromisesPerStream[listenerInfo.stream])
        }
    }

    const closeAllSessions = () => new Promise((resolve) => {
        let r = 0
        rest.post(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/close-all-sessions`, {
            timeout: 100000,
        }).on("complete", function (body, response) {
            if (response && (response.statusCode === 200 || response.statusCode === 204)) {
                return resolve(body)
            }
            r++
            this.retry(2000^r)
        }).on("timeout", function () {
            r++
            this.retry(2000^r)
        })
    })

    await closeAllSessions()

    events.on("listenerTunedIn", (listenerInfo) => {
        if (!listenerInfo) {
            return;
        }
        wait(5000).then(() => { // only record listener if still there after 5 seconds to verify it is not a failed request
            if (listenerInfo.id && closedListenerPromisesPerStream[listenerInfo.stream] && closedListenerPromisesPerStream[listenerInfo.stream][listenerInfo.id]) { 
                return
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
    })
    events.on("listenerTunedOut", closeListenerSession)

    events.on("metadata", (meta) => {
        if (!meta) {
            return
        }
        let r = 0
        rest.postJson(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/store-song`, meta, {
            timeout: 100000,
        }).on("complete", function (body, response) {
            if (response && (response.statusCode === 200 || response.statusCode === 204)) {
                return
            }
            r++
            this.retry(2000^r)
        }).on("timeout", function () {
            r++
            this.retry(2000^r)
        })
    });

    const postStatus = (streaminfo) => {
        let r = 0
        rest.postJson(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/store-status`, streaminfo, {
            timeout: 100000,
        }).on("complete", function (body, response) {
            if (response && (response.statusCode === 200 || response.statusCode === 204)) {
                return
            }
            r++
            this.retry(2000^r)
        }).on("timeout", function () {
            r++
            this.retry(2000^r)
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

    const cleanClosedSessions = () => {
        for (let stream in closedListenerPromisesPerStream) {
            if (closedListenerPromisesPerStream.hasOwnProperty(stream)) {
                for (let id in closedListenerPromisesPerStream[stream]){
                    if (closedListenerPromisesPerStream[stream].hasOwnProperty(id)) {
                        if (Date.now() - closedListenerPromisesPerStream[stream][id] > ONE_HOUR) {
                            delete closedListenerPromisesPerStream[stream][id]
                        }
                    }
                }
            }
        }
    }

    new CronJob({
        cronTime: "0 * * * * *",
        onTick: reportStatus,
        start: true,
    })

    new CronJob({
        cronTime: "0 * * * * *",
        onTick: cleanClosedSessions,
        start: true,
    })

}
