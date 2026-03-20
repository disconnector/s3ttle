/**
 * SignInView.swift — The Sign in with Apple screen.
 *
 * WHAT THIS FILE DOES:
 * Shows the app branding and a native "Sign in with Apple" button.
 * This is the ONLY screen the user sees in the native app — everything
 * else is the web app running in a WKWebView.
 *
 * HOW SIGN IN WITH APPLE WORKS:
 * 1. User taps the Sign in with Apple button
 * 2. iOS shows its native sign-in sheet (dark, with Face ID / Touch ID)
 * 3. User authenticates with biometrics or password
 * 4. Apple returns a credential (user ID, optional name + email)
 * 5. We pass the result to AuthService, which stores the user ID in Keychain
 * 6. AuthService.isAuthenticated flips to true
 * 7. S3ttleApp.swift sees the change and switches to WebViewContainer
 *
 * DESIGN:
 * Clean, minimal screen with the S3ttle logo and a single CTA button.
 * The button uses Apple's official SignInWithAppleButton — required by
 * Apple's Human Interface Guidelines. You can't make your own custom
 * Apple sign-in button.
 */

import SwiftUI
import AuthenticationServices

struct SignInView: View {
    /// The shared auth service that manages credential state.
    @ObservedObject var authService: AuthService

    var body: some View {
        ZStack {
            // ── Background ────────────────────────────────────────────────
            // Dark gradient background matching the web app's dark theme
            LinearGradient(
                colors: [
                    Color(red: 0.05, green: 0.05, blue: 0.08),
                    Color(red: 0.08, green: 0.08, blue: 0.12)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // ── App Branding ──────────────────────────────────────────
                VStack(spacing: 12) {
                    Text("S3ttle")
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                        .foregroundColor(.white)

                    Text("Big decisions. Both of you. Together.")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                }

                Spacer()

                // ── Sign in with Apple Button ─────────────────────────────
                // This is Apple's official button component. It automatically:
                // - Shows the correct text ("Sign in with Apple")
                // - Adapts to the color scheme (we use .white on dark background)
                // - Has the Apple logo built in
                //
                // The onRequest closure configures what we're asking for.
                // The onCompletion closure handles the result.
                VStack(spacing: 16) {
                    SignInWithAppleButton(.signIn) { request in
                        // Request the user's name and email.
                        // Apple only provides these on the FIRST sign-in.
                        // After that, only the user identifier is returned.
                        request.requestedScopes = [.fullName, .email]
                    } onCompletion: { result in
                        // Pass the result (success or failure) to AuthService
                        authService.handleSignInSuccess(result)
                    }
                    .signInWithAppleButtonStyle(.white)
                    .frame(height: 50)
                    .cornerRadius(12)

                    Text("Your data stays on your device.\nNo passwords to remember.")
                        .font(.caption)
                        .foregroundColor(.gray)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 40)
                .padding(.bottom, 60)
            }
        }
    }
}
