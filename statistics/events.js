import rest from "restler"

export default async (info) => {

    const getListenerUID = (listenerInfo) => new Promise((resolve, reject) => {
        rest.post(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/create-session`, {
            timeout: 100000,
            body: listenerInfo,
        }).on("complete", body => resolve(body)).on("timeout", err => reject(err))
    })

    const closeListenerSession = (listenerInfo) => {
        if (streams.streamListeners[listenerInfo.id].statsPromise) {
            streams.streamListeners[listenerInfo.id].statsPromise.then(({ uid }) => {
                rest.post(`${info.itframeURL}/cast/statistics/${info.username}/${info.key}/close-session`, {
                    body: { uid },
                })
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
        streams.streamListeners[listenerInfo.id].statsPromise = getListenerUID(listenerInfo)
    })
    events.on("listenerTunedOut", closeListenerSession)
}
