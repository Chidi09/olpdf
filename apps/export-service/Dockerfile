FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY main.go .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o export-service .

FROM scratch
COPY --from=builder /app/export-service /export-service
EXPOSE 8002
ENTRYPOINT ["/export-service"]
