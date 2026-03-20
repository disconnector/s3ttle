/**
 * WebViewContainer.swift — The WKWebView that hosts the entire S3ttle web app.
 *
 * WHAT THIS FILE DOES:
 * Wraps a WKWebView in a SwiftUI view. The web view loads the S3ttle web app
 * from the configured URL. Once loaded, it injects the user's Apple ID token
 * into the web app via a JavaScript bridge so the web app knows who the user is.
 *
 * WHY WKWebView?
 * The entire S3ttle UI lives in the React web app. The native shell exists only for:
 * - Sign in with Apple (requires native APIs)
 * - App Store distribution (home screen icon, push notifications later)
 *
 * This means we can update the app's UI and features by deploying the web app,
 * WITHOUT pushing an App Store update. Only auth changes need native updates.
 *
 * THE JAVASCRIPT BRIDGE:
 * When the web app loads, we inject a small script that sets:
 *   window.S3ttle = { userIdentifier: "001234.abc...", userName: "Rich" }
 *
 * The web app checks for this object on load. If present, it skips its own
 * profile setup and uses the native credentials directly. In M2, the backend
 * will verify the Apple user ID server-side.
 *
 * The bridge also listens for messages FROM the web app via
 * WKScriptMessageHandler. For example, the web app can send:
 *   window.webkit.messageHandlers.s3ttle.postMessage({ action: "signOut" })
 * to trigger a native sign-out.
 *
 * UIViewRepresentable:
 * SwiftUI can't host WKWebView directly. UIViewRepresentable is the bridge
 * pattern — it wraps a UIKit view (WKWebView) so SwiftUI can display it.
 * The Coordinator class acts as the delegate, handling navigation events
 * and JavaScript messages.
 */

import SwiftUI
import WebKit

// ── SwiftUI Wrapper ──────────────────────────────────────────────────────────

struct WebViewContainer: UIViewRepresentable {
    /// The auth service — we read the user's Apple ID to pass to the web app.
    @ObservedObject var authService: AuthService

    // ── Create the WKWebView ─────────────────────────────────────────────────
    func makeUIView(context: Context) -> WKWebView {
        // Configure the web view
        let config = WKWebViewConfiguration()

        // Allow inline media playback (prevents full-screen video hijack)
        config.allowsInlineMediaPlayback = true

        // Register our JavaScript message handler.
        // The web app can send messages to native via:
        //   window.webkit.messageHandlers.s3ttle.postMessage({...})
        config.userContentController.add(
            context.coordinator,
            name: "s3ttle"
        )

        // Inject the auth token script that runs when the page finishes loading.
        // This makes the user's identity available to the web app immediately.
        let tokenScript = buildTokenInjectionScript()
        let userScript = WKUserScript(
            source: tokenScript,
            injectionTime: .atDocumentEnd,   // Run after the page's own JS has loaded
            forMainFrameOnly: true           // Only inject in the main frame, not iframes
        )
        config.userContentController.addUserScript(userScript)

        // Create the web view
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator

        // Allow swipe-back navigation (feels native)
        webView.allowsBackForwardNavigationGestures = true

        // Make background transparent while loading (avoids white flash)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear

        // Disable bouncy overscroll on the main scroll view
        // (the web app handles its own scrolling)
        webView.scrollView.bounces = false

        // Load the web app
        if let url = URL(string: WebViewConfig.webAppURL) {
            webView.load(URLRequest(url: url))
        }

        return webView
    }

    // ── Update (called when SwiftUI state changes) ───────────────────────────
    func updateUIView(_ webView: WKWebView, context: Context) {
        // If the user signs out from the web app, this will be called.
        // We don't need to do anything here — the auth gate in S3ttleApp.swift
        // will switch back to SignInView automatically.
    }

    // ── Coordinator (handles delegates + JS messages) ────────────────────────
    func makeCoordinator() -> Coordinator {
        Coordinator(authService: authService)
    }

    // ── Build the Token Injection Script ─────────────────────────────────────
    /**
     * Creates a JavaScript snippet that exposes the native auth data to the web app.
     *
     * After injection, the web app can access:
     *   window.S3ttle.userIdentifier  → the Apple user ID
     *   window.S3ttle.userName        → the user's display name (if available)
     *   window.S3ttle.userEmail       → the user's email (if available)
     *   window.S3ttle.isNativeApp     → true (so the web app knows it's in the shell)
     *
     * The web app should check for `window.S3ttle?.isNativeApp` on load to
     * decide whether to show its own profile setup or use native credentials.
     */
    private func buildTokenInjectionScript() -> String {
        let userId = authService.userIdentifier ?? ""
        let userName = authService.userName ?? ""
        let userEmail = authService.userEmail ?? ""

        // Escape any special characters in the strings for safe JS injection
        let safeUserId = userId.replacingOccurrences(of: "'", with: "\\'")
        let safeUserName = userName.replacingOccurrences(of: "'", with: "\\'")
        let safeUserEmail = userEmail.replacingOccurrences(of: "'", with: "\\'")

        return """
        window.S3ttle = {
            isNativeApp: true,
            userIdentifier: '\(safeUserId)',
            userName: '\(safeUserName)',
            userEmail: '\(safeUserEmail)'
        };
        console.log('[S3ttle Native] Auth bridge injected. userName=' + window.S3ttle.userName);
        """
    }

    // ── Coordinator Class ────────────────────────────────────────────────────

    /**
     * The Coordinator handles two jobs:
     * 1. WKNavigationDelegate — monitors page load events (loading, errors, etc.)
     * 2. WKScriptMessageHandler — receives messages sent FROM the web app to native
     *
     * This is the standard pattern for WKWebView in SwiftUI. The Coordinator is
     * a reference type (class) that persists across SwiftUI view updates.
     */
    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let authService: AuthService

        init(authService: AuthService) {
            self.authService = authService
        }

        // ── WKNavigationDelegate ─────────────────────────────────────────
        // Called when the page finishes loading successfully
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            print("[WebView] Page loaded: \(webView.url?.absoluteString ?? "unknown")")
        }

        // Called when navigation fails
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            print("[WebView] Navigation failed: \(error.localizedDescription)")
        }

        // Called when the page itself fails to load (network error, etc.)
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            print("[WebView] Provisional navigation failed: \(error.localizedDescription)")
            // TODO: Show an offline/error screen in the web view
        }

        // ── WKScriptMessageHandler ───────────────────────────────────────
        /**
         * Handles messages sent from the web app via:
         *   window.webkit.messageHandlers.s3ttle.postMessage({ action: "..." })
         *
         * Currently supported actions:
         * - "signOut" → triggers native sign-out, returns to SignInView
         *
         * Future actions might include:
         * - "hapticFeedback" → trigger native haptic feedback
         * - "shareSession"   → open native share sheet
         */
        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard let body = message.body as? [String: Any],
                  let action = body["action"] as? String else {
                print("[WebView] Received invalid message from web app")
                return
            }

            switch action {
            case "signOut":
                print("[WebView] Sign out requested by web app")
                DispatchQueue.main.async {
                    self.authService.signOut()
                }
            default:
                print("[WebView] Unknown action: \(action)")
            }
        }
    }
}
