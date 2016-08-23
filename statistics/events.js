import rest from "restler"

export default async (info) => {

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
        if (listenerInfo && listenerInfo.statsPromise) {
            listenerInfo.statsPromise.then(({ uid }) => {
                if (!uid) {
                    return
                }
                rest.postJson(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/close-session`, { uid }, {
                    timeout: 100000,
                }).on("complete", function (body, response) {
                    if (response.statusCode !== 200 && response.statusCode !== 204) {
                        this.retry(2000)
                    }
                }).on("timeout", function () {
                    this.retry(2000)
                })
            })
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
        streams.streamListeners[listenerInfo.stream][listenerInfo.id].statsPromise = getListenerUID(listenerInfo)
    })
    events.on("listenerTunedOut", closeListenerSession)
}
