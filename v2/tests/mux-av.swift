// Mux a video-only MP4 and an audio-only M4A into one MP4 without re-encoding (used by record-demo.mjs).
// Usage: swift tests/mux-av.swift video.mp4 audio.m4a out.mp4
import AVFoundation
let a = CommandLine.arguments
let video = AVURLAsset(url: URL(fileURLWithPath: a[1])), audio = AVURLAsset(url: URL(fileURLWithPath: a[2]))
let out = URL(fileURLWithPath: a[3])
try? FileManager.default.removeItem(at: out)
let comp = AVMutableComposition()
let sem = DispatchSemaphore(value: 0)
Task {
  do {
    let vt = try await video.loadTracks(withMediaType: .video)[0], at = try await audio.loadTracks(withMediaType: .audio)[0]
    let vd = try await video.load(.duration), ad = try await audio.load(.duration)
    let dur = CMTimeMinimum(vd, ad)
    let cv = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try cv.insertTimeRange(CMTimeRange(start: .zero, duration: dur), of: vt, at: .zero)
    let ca = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try ca.insertTimeRange(CMTimeRange(start: .zero, duration: dur), of: at, at: .zero)
    let ex = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetPassthrough)!
    ex.outputURL = out; ex.outputFileType = .mp4; ex.shouldOptimizeForNetworkUse = true
    await ex.export()
    if ex.status != .completed { print("mux failed:", ex.error ?? "unknown"); exit(1) }
    print(String(format: "muxed %.1fs (video %.1fs, audio %.1fs) -> %@", CMTimeGetSeconds(dur), CMTimeGetSeconds(vd), CMTimeGetSeconds(ad), a[3]))
  } catch { print("mux error:", error); exit(1) }
  sem.signal()
}
sem.wait()
