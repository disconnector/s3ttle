/**
 * AuthService.swift — Manages authentication via Sign in with Apple.
 *
 * WHAT THIS FILE DOES:
 * Handles the entire Sign in with Apple flow:
 * 1. Presents the native Apple sign-in sheet
 * 2. Receives the Apple ID credential (user ID, name, email)
 * 3. Stores the user ID in Keychain for persistent login
 * 4. Checks on app launch whether the credential is still valid
 *
 * WHY SIGN IN WITH APPLE?
 * - Zero friction: users tap one button, Face ID confirms, done
 * - No passwords to remember or manage
 * - Apple handles email privacy (Hide My Email)
 * - Required by App Store if you offer any other social sign-in
 * - Perfect for a couples app — each partner signs in on their own device
 *
 * KEYCHAIN STORAGE:
 * We store the Apple "user identifier" (a stable, opaque string like
 * "001234.abcdef...") in the iOS Keychain. The Keychain is:
 * - Encrypted at rest (hardware-backed on devices with Secure Enclave)
 * - Persists across app reinstalls (unlike UserDefaults)
 * - Scoped to this app (other apps can't read it)
 *
 * On each app launch, we call Apple's credential state API to verify
 * the user hasn't revoked access. If they have, we clear the Keychain
 * and show the sign-in screen again.
 *
 * THE TOKEN FOR THE WEB APP:
 * When the web app loads, the native shell passes the Apple user ID to it
 * via a JavaScript bridge. The web app can then send this to the backend
 * for authentication. In M2, the backend will verify this with Apple's
 * servers and issue a session token.
 */

import Foundation
import AuthenticationServices

/// ObservableObject lets SwiftUI views react to changes in this class.
/// When `isAuthenticated` changes, any view watching it re-renders automatically.
class AuthService: ObservableObject {

    // ── Published Properties ─────────────────────────────────────────────────
    // @Published means SwiftUI will re-render views when these change.

    /// Whether the user is currently signed in.
    @Published var isAuthenticated = false

    /// The user's display name from Apple (may be nil after first sign-in).
    @Published var userName: String?

    /// The user's email from Apple (may be nil or a relay address).
    @Published var userEmail: String?

    /// The Apple user identifier — a stable, unique string for this user.
    /// This is what we pass to the web app and eventually to the backend.
    @Published var userIdentifier: String?

    // ── Keychain Key ──────────────────────────────────────────────────────────
    /// The key under which we store the Apple user ID in Keychain.
    private let keychainKey = "com.s3ttle.apple-user-id"

    // ── Initialization ────────────────────────────────────────────────────────

    init() {
        // On launch, check if we have a stored credential and if it's still valid
        checkExistingCredential()
    }

    // ── Public Methods ────────────────────────────────────────────────────────

    /**
     * Handle a successful Sign in with Apple result.
     *
     * Called by SignInView when the Apple sign-in sheet completes successfully.
     * Extracts the credential data, saves it to Keychain, and updates state.
     *
     * IMPORTANT: Apple only provides the user's name and email on the FIRST
     * sign-in. Subsequent sign-ins only return the user identifier. So we
     * must save the name/email on first use.
     */
    func handleSignInSuccess(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
                return
            }

            let userId = credential.user

            // Name is only provided on first sign-in
            if let fullName = credential.fullName {
                let name = [fullName.givenName, fullName.familyName]
                    .compactMap { $0 }
                    .joined(separator: " ")
                if !name.isEmpty {
                    self.userName = name
                    // Save name to UserDefaults (Keychain is for the ID only)
                    UserDefaults.standard.set(name, forKey: "s3ttle-user-name")
                }
            }

            // Email is only provided on first sign-in
            if let email = credential.email {
                self.userEmail = email
                UserDefaults.standard.set(email, forKey: "s3ttle-user-email")
            }

            // Save the user ID to Keychain for persistent login
            saveToKeychain(userId)
            self.userIdentifier = userId
            self.isAuthenticated = true

            print("[Auth] Sign in successful. userId=\(userId.prefix(8))...")

        case .failure(let error):
            // User cancelled or something went wrong
            print("[Auth] Sign in failed: \(error.localizedDescription)")
        }
    }

    /**
     * Sign out — clear stored credentials and return to the sign-in screen.
     */
    func signOut() {
        deleteFromKeychain()
        self.isAuthenticated = false
        self.userIdentifier = nil
        self.userName = nil
        self.userEmail = nil
        print("[Auth] Signed out")
    }

    // ── Private Methods ───────────────────────────────────────────────────────

    /**
     * Check if we have a valid stored credential on app launch.
     *
     * Flow:
     * 1. Read the Apple user ID from Keychain
     * 2. If found, ask Apple if the credential is still valid
     * 3. If valid → auto-sign-in (no UI shown)
     * 4. If revoked/not found → show sign-in screen
     */
    private func checkExistingCredential() {
        guard let userId = readFromKeychain() else {
            // No stored credential — user needs to sign in
            self.isAuthenticated = false
            return
        }

        // Ask Apple if this credential is still valid
        let provider = ASAuthorizationAppleIDProvider()
        provider.getCredentialState(forUserID: userId) { [weak self] state, _ in
            DispatchQueue.main.async {
                switch state {
                case .authorized:
                    // Credential is still valid — auto-sign-in
                    self?.userIdentifier = userId
                    self?.userName = UserDefaults.standard.string(forKey: "s3ttle-user-name")
                    self?.userEmail = UserDefaults.standard.string(forKey: "s3ttle-user-email")
                    self?.isAuthenticated = true
                    print("[Auth] Existing credential valid. Auto-signed in.")

                case .revoked, .notFound:
                    // Credential was revoked or doesn't exist — clear and show sign-in
                    self?.deleteFromKeychain()
                    self?.isAuthenticated = false
                    print("[Auth] Existing credential invalid. Showing sign-in.")

                default:
                    self?.isAuthenticated = false
                }
            }
        }
    }

    // ── Keychain Helpers ──────────────────────────────────────────────────────
    // These use the iOS Security framework to store/read/delete the Apple
    // user ID from the device's encrypted Keychain.

    private func saveToKeychain(_ value: String) {
        let data = Data(value.utf8)

        // Delete any existing entry first (Keychain won't overwrite)
        deleteFromKeychain()

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: keychainKey,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        if status != errSecSuccess {
            print("[Auth] Keychain save failed: \(status)")
        }
    }

    private func readFromKeychain() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: keychainKey,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    private func deleteFromKeychain() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: keychainKey,
        ]

        SecItemDelete(query as CFDictionary)
    }
}
