import rest from "restler"

export default async (info) => {

    const getListenerUID = (listenerInfo) => new Promise((resolve, reject) => {
        rest.postJson(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/create-session`, listenerInfo, {
            timeout: 100000,
        }).on("complete", (body) => {
            resolve(body)
        }).on("timeout", (err) => {reject(err)})
    })

    const closeListenerSession = (listenerInfo) => {
        if (listenerInfo && listenerInfo.statsPromise) {
            listenerInfo.statsPromise.then(({ uid }) => {
                if (!uid) {
                    return
                }
                rest.postJson(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/close-session`, { uid })
            })
        }
    }

    const closeAllSessions = () => new Promise((resolve) => {
        rest.post(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/close-all-sessions`)
        .on("complete", () => {
            resolve()
        })
    })

    await closeAllSessions()

    events.on("listenerTunedIn", (listenerInfo) => {
        streams.streamListeners[listenerInfo.stream][listenerInfo.id].statsPromise = getListenerUID(listenerInfo)
    })
    events.on("listenerTunedOut", closeListenerSession)
}
