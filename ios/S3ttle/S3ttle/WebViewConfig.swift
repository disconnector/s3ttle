/**
 * WebViewConfig.swift — Configuration for the web app URL.
 *
 * WHAT THIS FILE DOES:
 * Centralizes the URL that the WKWebView loads. This is the ONLY place
 * you need to change the URL when switching between:
 * - Local development (your Mac's IP on the local network)
 * - Staging (a test deployment)
 * - Production (the live Railway deployment)
 *
 * HOW TO USE IN DEVELOPMENT:
 * 1. Find your Mac's local IP: System Settings → Wi-Fi → Details → IP Address
 * 2. Make sure the Vite dev server is running with host: '0.0.0.0'
 * 3. Set the URL below to http://YOUR_IP:5173
 * 4. Make sure your iPhone is on the same Wi-Fi network
 *
 * In production, this will point to your Railway deployment URL.
 */

import Foundation

enum WebViewConfig {
    // ── URL Configuration ────────────────────────────────────────────────

    /// The URL of the S3ttle web app.
    ///
    /// Mac Catalyst runs on the same machine as the Vite dev server,
    /// so localhost is reliable and avoids IP address issues.
    /// iPhone (device or simulator) needs the Mac's Wi-Fi IP address.
    ///
    /// Production: Replace with your Railway URL.
    #if targetEnvironment(macCatalyst)
        // Mac Catalyst: same machine — use localhost
        static let webAppURL = "http://localhost:5173"
    #else
        // iOS device/simulator: needs the Mac's Wi-Fi IP
        // Find yours: System Settings → Wi-Fi → Details → IP Address
        static let webAppURL = "http://192.168.50.250:5173"
    #endif
}
