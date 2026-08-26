# ── Build Stage ─────────────────────────────────────────────────────────────
FROM gcc:13-bookworm AS build
WORKDIR /app

COPY . .

# Compile directly with g++ and statically link libstdc++ and libgcc
RUN g++ -std=c++17 -O3 -pthread \
    -static-libgcc -static-libstdc++ \
    -Iinclude -Ithird_party \
    main.cpp src/fcfs.cpp src/sjf.cpp src/srtf.cpp src/round_robin.cpp src/priority.cpp \
    -o server

# ── Runtime Stage ────────────────────────────────────────────────────────────
FROM debian:bookworm-slim
WORKDIR /app

COPY --from=build /app/server ./server

# Default port
ENV PORT=8080
EXPOSE 8080

CMD ["./server"]
