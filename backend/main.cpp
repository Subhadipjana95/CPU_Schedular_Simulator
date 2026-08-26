#include "SchedulerDispatch.hpp"
#include <nlohmann/json.hpp>
#include <iostream>
#include <string>
#include <sstream>
#include <vector>
#include <cstdlib>
#include <cstring>

#ifdef _WIN32
  #include <winsock2.h>
  #include <ws2tcpip.h>
  #include <windows.h>
  #pragma comment(lib, "ws2_32.lib")
  typedef SOCKET socket_handle;
  #define CLOSE_SOCKET(s) closesocket(s)
#else
  #include <sys/socket.h>
  #include <netinet/in.h>
  #include <unistd.h>
  #include <pthread.h>
  typedef int socket_handle;
  #define INVALID_SOCKET (-1)
  #define SOCKET_ERROR (-1)
  #define CLOSE_SOCKET(s) close(s)
#endif

using json = nlohmann::json;

static void handle_client(socket_handle client_sock) {
    std::vector<char> buffer(65536);
    int bytes_received = recv(client_sock, buffer.data(), static_cast<int>(buffer.size()) - 1, 0);
    if (bytes_received <= 0) {
        CLOSE_SOCKET(client_sock);
        return;
    }
    buffer[bytes_received] = '\0';
    std::string request_raw(buffer.data(), bytes_received);

    // Extract headers and body
    size_t header_end = request_raw.find("\r\n\r\n");
    std::string headers_str;
    std::string body;
    if (header_end != std::string::npos) {
        headers_str = request_raw.substr(0, header_end);
        body = request_raw.substr(header_end + 4);
    } else {
        headers_str = request_raw;
    }

    std::istringstream stream(headers_str);
    std::string method, path, version;
    stream >> method >> path >> version;

    // Handle Content-Length for large payloads
    size_t cl_pos = headers_str.find("Content-Length:");
    if (cl_pos == std::string::npos) {
        cl_pos = headers_str.find("content-length:");
    }
    if (cl_pos != std::string::npos) {
        size_t line_end = headers_str.find("\r\n", cl_pos);
        std::string cl_val = headers_str.substr(cl_pos + 15, line_end - (cl_pos + 15));
        int content_length = std::atoi(cl_val.c_str());
        while (static_cast<int>(body.length()) < content_length) {
            int extra = recv(client_sock, buffer.data(), static_cast<int>(buffer.size()) - 1, 0);
            if (extra <= 0) break;
            body.append(buffer.data(), extra);
        }
    }

    std::ostringstream response;

    auto make_cors_headers = []() {
        return "Access-Control-Allow-Origin: *\r\n"
               "Access-Control-Allow-Methods: POST, GET, OPTIONS\r\n"
               "Access-Control-Allow-Headers: Content-Type, Accept\r\n";
    };

    if (method == "OPTIONS") {
        response << "HTTP/1.1 204 No Content\r\n"
                 << make_cors_headers()
                 << "Content-Length: 0\r\n"
                 << "Connection: close\r\n\r\n";
    } else if (method == "GET" && path == "/api/health") {
        std::string resp_body = R"({"status":"ok"})";
        response << "HTTP/1.1 200 OK\r\n"
                 << make_cors_headers()
                 << "Content-Type: application/json\r\n"
                 << "Content-Length: " << resp_body.length() << "\r\n"
                 << "Connection: close\r\n\r\n"
                 << resp_body;
    } else if (method == "POST" && (path == "/api/schedule" || path == "/api/schedule/")) {
        try {
            if (body.empty()) {
                std::string err_body = R"({"error":"Empty request body"})";
                response << "HTTP/1.1 400 Bad Request\r\n"
                         << make_cors_headers()
                         << "Content-Type: application/json\r\n"
                         << "Content-Length: " << err_body.length() << "\r\n"
                         << "Connection: close\r\n\r\n"
                         << err_body;
            } else {
                json input = json::parse(body);
                if (!input.contains("algorithm") || !input.contains("processes")) {
                    std::string err_body = R"({"error":"Missing required fields: algorithm, processes"})";
                    response << "HTTP/1.1 400 Bad Request\r\n"
                             << make_cors_headers()
                             << "Content-Type: application/json\r\n"
                             << "Content-Length: " << err_body.length() << "\r\n"
                             << "Connection: close\r\n\r\n"
                             << err_body;
                } else {
                    std::string algo = input.at("algorithm").get<std::string>();
                    const auto& registry = scheduler_registry();
                    auto it = registry.find(algo);
                    if (it == registry.end()) {
                        std::string err_body = R"({"error":"Unknown algorithm. Valid: fcfs, sjf, srtf, round_robin, priority"})";
                        response << "HTTP/1.1 400 Bad Request\r\n"
                                 << make_cors_headers()
                                 << "Content-Type: application/json\r\n"
                                 << "Content-Length: " << err_body.length() << "\r\n"
                                 << "Connection: close\r\n\r\n"
                                 << err_body;
                    } else {
                        json output = it->second(input);
                        std::string resp_body = output.dump();
                        response << "HTTP/1.1 200 OK\r\n"
                                 << make_cors_headers()
                                 << "Content-Type: application/json\r\n"
                                 << "Content-Length: " << resp_body.length() << "\r\n"
                                 << "Connection: close\r\n\r\n"
                                 << resp_body;
                    }
                }
            }
        } catch (const std::exception& e) {
            std::string err_body = std::string(R"({"error":")") + e.what() + R"("})";
            response << "HTTP/1.1 400 Bad Request\r\n"
                     << make_cors_headers()
                     << "Content-Type: application/json\r\n"
                     << "Content-Length: " << err_body.length() << "\r\n"
                     << "Connection: close\r\n\r\n"
                     << err_body;
        }
    } else {
        std::string not_found = R"({"error":"Not Found"})";
        response << "HTTP/1.1 404 Not Found\r\n"
                 << make_cors_headers()
                 << "Content-Type: application/json\r\n"
                 << "Content-Length: " << not_found.length() << "\r\n"
                 << "Connection: close\r\n\r\n"
                 << not_found;
    }

    std::string resp_str = response.str();
    send(client_sock, resp_str.c_str(), static_cast<int>(resp_str.length()), 0);
    CLOSE_SOCKET(client_sock);
}

#ifdef _WIN32
DWORD WINAPI ClientThread(LPVOID lpParam) {
    socket_handle client_sock = reinterpret_cast<socket_handle>(lpParam);
    handle_client(client_sock);
    return 0;
}
#else
void* ClientThread(void* arg) {
    socket_handle client_sock = (socket_handle)(intptr_t)arg;
    handle_client(client_sock);
    return nullptr;
}
#endif

int main() {
    int port = 8080;
    const char* env_port = std::getenv("PORT");
    if (env_port) {
        port = std::atoi(env_port);
    }

#ifdef _WIN32
    WSADATA wsaData;
    int res = WSAStartup(MAKEWORD(2, 2), &wsaData);
    if (res != 0) {
        std::cerr << "WSAStartup failed: " << res << std::endl;
        return 1;
    }
#endif

    socket_handle server_sock = socket(AF_INET, SOCK_STREAM, 0);
    if (server_sock == INVALID_SOCKET) {
        std::cerr << "Socket creation failed" << std::endl;
        return 1;
    }

    int opt = 1;
    setsockopt(server_sock, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));

    sockaddr_in server_addr;
    std::memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(port);

    if (bind(server_sock, reinterpret_cast<sockaddr*>(&server_addr), sizeof(server_addr)) == SOCKET_ERROR) {
        std::cerr << "Bind failed on port " << port << std::endl;
        CLOSE_SOCKET(server_sock);
        return 1;
    }

    if (listen(server_sock, SOMAXCONN) == SOCKET_ERROR) {
        std::cerr << "Listen failed" << std::endl;
        CLOSE_SOCKET(server_sock);
        return 1;
    }

    std::cout << "==========================================================" << std::endl;
    std::cout << " CPU Scheduler backend running on port " << port << std::endl;
    std::cout << "==========================================================" << std::endl;

    while (true) {
        sockaddr_in client_addr;
        socklen_t client_size = sizeof(client_addr);
        socket_handle client_sock = accept(server_sock, reinterpret_cast<sockaddr*>(&client_addr), &client_size);
        if (client_sock == INVALID_SOCKET) {
            continue;
        }

#ifdef _WIN32
        HANDLE thread = CreateThread(NULL, 0, ClientThread, reinterpret_cast<LPVOID>(client_sock), 0, NULL);
        if (thread) {
            CloseHandle(thread);
        } else {
            handle_client(client_sock);
        }
#else
        pthread_t thread;
        if (pthread_create(&thread, nullptr, ClientThread, (void*)(intptr_t)client_sock) == 0) {
            pthread_detach(thread);
        } else {
            handle_client(client_sock);
        }
#endif
    }

    CLOSE_SOCKET(server_sock);
#ifdef _WIN32
    WSACleanup();
#endif
    return 0;
}
