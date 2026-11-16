package com.endless.stream;

import android.graphics.Color;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.common.TrackGroup;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.common.Tracks;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.ui.PlayerView;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "ExoPlayerPlugin")
public class ExoPlayerPlugin extends Plugin {

    private ExoPlayer player;
    private PlayerView playerView;
    private DefaultTrackSelector trackSelector;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private static class AudioTrackEntry {
        int globalIndex;
        TrackGroup group;
        int trackIndexInGroup;
        String id;
        String label;
        String language;
        int channels;
        boolean isSelected;
    }

    private final List<AudioTrackEntry> cachedAudioTracks = new ArrayList<>();

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        ret.put("engine", "Media3 ExoPlayer");
        call.resolve(ret);
    }

    @PluginMethod
    public void load(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("URL is required");
            return;
        }

        long positionMs = call.getLong("positionMs", 0L);
        boolean autoPlay = call.getBoolean("autoPlay", true);

        mainHandler.post(() -> {
            try {
                if (player == null) {
                    trackSelector = new DefaultTrackSelector(getContext());
                    player = new ExoPlayer.Builder(getContext())
                            .setTrackSelector(trackSelector)
                            .build();

                    playerView = new PlayerView(getContext());
                    playerView.setPlayer(player);
                    playerView.setUseController(false); // Seamless living Apple TV+ React controls
                    playerView.setBackgroundColor(Color.BLACK);

                    // Make WebView background transparent so native ExoPlayer view behind it renders smoothly
                    getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);

                    ViewGroup root = (ViewGroup) getBridge().getWebView().getParent();
                    if (root != null) {
                        // Insert playerView behind the webview
                        root.addView(playerView, 0, new FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                        ));
                    }

                    player.addListener(new Player.Listener() {
                        @Override
                        public void onPlaybackStateChanged(int playbackState) {
                            JSObject data = new JSObject();
                            data.put("state", playbackState);
                            data.put("isBuffering", playbackState == Player.STATE_BUFFERING);
                            data.put("isEnded", playbackState == Player.STATE_ENDED);
                            notifyListeners("playbackStateChanged", data);
                        }

                        @Override
                        public void onIsPlayingChanged(boolean isPlaying) {
                            JSObject data = new JSObject();
                            data.put("isPlaying", isPlaying);
                            notifyListeners("isPlayingChanged", data);
                        }

                        @Override
                        public void onTracksChanged(Tracks tracks) {
                            refreshAudioTracksCache(tracks);
                            JSObject data = new JSObject();
                            data.put("audioTrackCount", cachedAudioTracks.size());
                            notifyListeners("tracksChanged", data);
                        }
                    });
                }

                MediaItem mediaItem = MediaItem.fromUri(Uri.parse(url));
                player.setMediaItem(mediaItem);
                if (positionMs > 0) {
                    player.seekTo(positionMs);
                }
                player.prepare();
                if (autoPlay) {
                    player.play();
                }

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to initialize ExoPlayer: " + e.getMessage());
            }
        });
    }

    private void refreshAudioTracksCache(Tracks tracks) {
        cachedAudioTracks.clear();
        int globalIdx = 0;
        for (Tracks.Group group : tracks.getGroups()) {
            if (group.getType() == C.TRACK_TYPE_AUDIO) {
                TrackGroup mediaGroup = group.getMediaTrackGroup();
                for (int i = 0; i < group.length; i++) {
                    if (group.isTrackSupported(i)) {
                        Format f = group.getTrackFormat(i);
                        AudioTrackEntry entry = new AudioTrackEntry();
                        entry.globalIndex = globalIdx++;
                        entry.group = mediaGroup;
                        entry.trackIndexInGroup = i;
                        entry.id = f.id != null ? f.id : String.valueOf(entry.globalIndex);
                        entry.language = f.language != null ? f.language : "und";
                        entry.channels = f.channelCount;
                        entry.isSelected = group.isTrackSelected(i);

                        String label = f.label;
                        if (label == null || label.trim().isEmpty()) {
                            String chStr = f.channelCount == 6 ? "5.1" : (f.channelCount == 8 ? "7.1" : (f.channelCount == 2 ? "Stereo" : ""));
                            String langStr = entry.language.toUpperCase();
                            label = langStr + (chStr.isEmpty() ? "" : " (" + chStr + ")");
                        }
                        entry.label = label;
                        cachedAudioTracks.add(entry);
                    }
                }
            }
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        mainHandler.post(() -> {
            if (player != null) {
                player.play();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        mainHandler.post(() -> {
            if (player != null) {
                player.pause();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        long positionMs = call.getLong("positionMs", 0L);
        mainHandler.post(() -> {
            if (player != null) {
                player.seekTo(positionMs);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        float vol = call.getFloat("volume", 1.0f);
        mainHandler.post(() -> {
            if (player != null) {
                player.setVolume(vol);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        mainHandler.post(() -> {
            JSObject ret = new JSObject();
            if (player != null) {
                long pos = player.getCurrentPosition();
                long dur = player.getDuration();
                ret.put("currentTime", pos >= 0 ? pos / 1000.0 : 0);
                ret.put("duration", dur > 0 ? dur / 1000.0 : 0);
                ret.put("isPlaying", player.isPlaying());
                ret.put("isBuffering", player.getPlaybackState() == Player.STATE_BUFFERING);
                ret.put("buffered", player.getBufferedPosition() >= 0 ? player.getBufferedPosition() / 1000.0 : 0);
            } else {
                ret.put("currentTime", 0);
                ret.put("duration", 0);
                ret.put("isPlaying", false);
                ret.put("isBuffering", false);
                ret.put("buffered", 0);
            }
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void getAudioTracks(PluginCall call) {
        mainHandler.post(() -> {
            JSArray arr = new JSArray();
            for (AudioTrackEntry entry : cachedAudioTracks) {
                JSObject obj = new JSObject();
                obj.put("index", entry.globalIndex);
                obj.put("id", entry.id);
                obj.put("label", entry.label);
                obj.put("language", entry.language);
                obj.put("channels", entry.channels);
                obj.put("isSelected", entry.isSelected);
                arr.put(obj);
            }
            JSObject ret = new JSObject();
            ret.put("tracks", arr);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void setAudioTrack(PluginCall call) {
        int targetIndex = call.getInt("index", -1);
        if (targetIndex < 0 || targetIndex >= cachedAudioTracks.size()) {
            call.reject("Invalid audio track index");
            return;
        }

        mainHandler.post(() -> {
            if (player != null) {
                AudioTrackEntry target = cachedAudioTracks.get(targetIndex);
                player.setTrackSelectionParameters(
                        player.getTrackSelectionParameters()
                                .buildUpon()
                                .setOverrideForType(new TrackSelectionOverride(target.group, target.trackIndexInGroup))
                                .build()
                );
                for (AudioTrackEntry entry : cachedAudioTracks) {
                    entry.isSelected = (entry.globalIndex == targetIndex);
                }
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void destroy(PluginCall call) {
        mainHandler.post(() -> {
            if (player != null) {
                player.release();
                player = null;
            }
            if (playerView != null) {
                ViewGroup parent = (ViewGroup) playerView.getParent();
                if (parent != null) {
                    parent.removeView(playerView);
                }
                playerView = null;
            }
            // Restore default opaque WebView background
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().setBackgroundColor(Color.BLACK);
            }
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (player != null) {
            player.release();
            player = null;
        }
        super.handleOnDestroy();
    }
}
