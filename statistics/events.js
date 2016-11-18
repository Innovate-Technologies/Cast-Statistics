import rest from "restler"
import _ from "underscore"

export default async (info) => {

    const listenerPromises = {}

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
        if (listenerInfo && listenerInfo.id && listenerPromises[listenerInfo.id]) {
            listenerPromises[listenerInfo.id].then(({ uid }) => {
                if (!uid) {
                    return
                }
                rest.postJson(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/close-session`, { uid }, {
                    timeout: 100000,
                }).on("complete", function (body, response) {
                    if (response.statusCode !== 200 && response.statusCode !== 204) {
                        return this.retry(2000)
                    }
                    delete listenerPromises[listenerInfo.id]
                }).on("timeout", function () {
                    this.retry(2000)
                })
            })
        } else {
            console.log(listenerInfo)
            console.log(listenerPromises[listenerInfo.id])
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
            console.log("Registering " + listenerInfo.id)
            listenerPromises[listenerInfo.id] = getListenerUID(listenerInfo)
            // _.findWhere(streams.streamListeners[listenerInfo.stream][listenerInfo.id], { id: listenerInfo.id }).statsPromise = getListenerUID(listenerInfo)
        } catch (error) {
            console.log(error)
        }
    })
    events.on("listenerTunedOut", closeListenerSession)
}
