FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o export-service .

FROM alpine:3.19
RUN apk add --no-cache curl
COPY --from=builder /app/export-service /export-service
EXPOSE 8002
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8002/health || exit 1
ENTRYPOINT ["/export-service"]
