/**
 * S3ttleApp.swift — The entry point of the iOS app.
 *
 * WHAT THIS FILE DOES:
 * This is the @main struct that SwiftUI uses to launch the app. It sets up
 * the app's root view and manages the authentication state.
 *
 * THE APP FLOW:
 * 1. On launch, check if the user has a saved Apple ID credential in Keychain
 * 2. If YES → show the WebView (the actual S3ttle web app)
 * 3. If NO  → show the Sign in with Apple screen
 *
 * WHY IS THIS SO SIMPLE?
 * The entire UI lives in the web app (React + shadcn). This native shell
 * exists only for:
 * - Authentication (Sign in with Apple / Face ID)
 * - Push notifications (future)
 * - App Store presence (home screen icon, distribution)
 *
 * Everything else — chat, AI interaction, message display — is the web app
 * running inside a WKWebView. Changes to the web app deploy instantly without
 * needing to push an App Store update.
 */

import SwiftUI

@main
struct S3ttleApp: App {
    /// Shared auth service — manages Sign in with Apple state.
    /// @StateObject keeps this alive for the entire app lifetime.
    @StateObject private var authService = AuthService()

    var body: some Scene {
        WindowGroup {
            // Simple gate: authenticated → web app, not authenticated → sign in
            if authService.isAuthenticated {
                WebViewContainer(authService: authService)
                    // Dark status bar text on light backgrounds (or vice versa)
                    .preferredColorScheme(.dark)
            } else {
                SignInView(authService: authService)
                    .preferredColorScheme(.dark)
            }
        }
    }
}
