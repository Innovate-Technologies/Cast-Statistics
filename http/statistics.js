import proxy from "http-proxy-middleware"
const info = {
    itframeURL: config.itframeURL || "https://itframe.innovatete.ch",
    username: config.username,
    key: (config.internal.statistics || {}).key,
}
export default (app) => {
    const proxyOptions = {
        target: info.itframeURL,
        changeOrigin: true,
        pathRewrite: {},
        logLevel: "silent",
        onProxyRes: (proxyRes) => {
            const newHeaders = {}
            if (proxyRes.headers["Content-Type"]) {
                newHeaders["Content-Type"] = proxyRes.headers["Content-Type"]
            }
            if (proxyRes.headers["Content-Disposition"]) {
                newHeaders["Content-Disposition"] = proxyRes.headers["Content-Disposition"]
            }
            proxyRes.headers = newHeaders; // replace all headers
        },
        headers: {
            "Accept-Encoding": "",
        },
    }

    proxyOptions.pathRewrite[`^/api/statistics/${global.config.apikey}/`] = `/cast/statistics/${info.username}/${info.key}/`

    app.get("/api/statistics/:key/*", (req, res, next) => {
        if (req.params.key !== global.config.apikey) {
            return res.status(400).json({error: "Invalid API key"})
        }
        return next()
    })
    app.use("/api/statistics/:key/*", proxy(proxyOptions));
}
