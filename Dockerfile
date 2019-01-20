FROM scratch

COPY ./bin /opt/cast-stats
COPY ./package.json /opt/cast-stats/package.json 