import UIKit
import AVFoundation
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    private func configureGameAudio() {
        let session = AVAudioSession.sharedInstance()

        do {
            try session.setCategory(
                .playback,
                mode: .default,
                options: [.mixWithOthers]
            )
            try session.setActive(true)
        } catch {
            print("[Corgi Hop audio] AVAudioSession setup failed: \(error)")
        }
    }

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        configureGameAudio()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Pause game activity when the app becomes inactive.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Preserve game state when entering the background.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Prepare the game to return to the foreground.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        configureGameAudio()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Save any final state if needed.
    }

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        return ApplicationDelegateProxy.shared.application(
            app,
            open: url,
            options: options
        )
    }

    func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        return ApplicationDelegateProxy.shared.application(
            application,
            continue: userActivity,
            restorationHandler: restorationHandler
        )
    }
}
