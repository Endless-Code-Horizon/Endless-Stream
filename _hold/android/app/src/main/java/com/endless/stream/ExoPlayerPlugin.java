package com.endless.stream;

import android.graphics.Color;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.TrackGroup;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.common.Tracks;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
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

    private String resolveStreamUrl(String rawUrl) {
        if (rawUrl == null) return "";
        String url = rawUrl.trim();
        if (url.isEmpty()) return "";

        // Standard schemes
        if (url.startsWith("http://") || url.startsWith("https://") ||
            url.startsWith("file://") || url.startsWith("content://") ||
            url.startsWith("asset://") || url.startsWith("rtmp://") ||
            url.startsWith("rtsp://")) {
            return url;
        }

        // Relative URL - prefix http://localhost:5173 or active host
        String host = "http://localhost:5173";
        try {
            if (getBridge() != null && getBridge().getServerUrl() != null) {
                String serverUrl = getBridge().getServerUrl().trim();
                if (serverUrl.startsWith("http://") || serverUrl.startsWith("https://")) {
                    if (serverUrl.endsWith("/")) {
                        serverUrl = serverUrl.substring(0, serverUrl.length() - 1);
                    }
                    host = serverUrl;
                }
            }
        } catch (Exception ignored) {}

        if (url.startsWith("/")) {
            return host + url;
        } else {
            return host + "/" + url;
        }
    }

    @PluginMethod
    public void load(PluginCall call) {
        String rawUrl = call.getString("url");
        if (rawUrl == null || rawUrl.trim().isEmpty()) {
            call.reject("URL is required");
            return;
        }

        final String finalUrl = resolveStreamUrl(rawUrl);
        long positionMs = call.getLong("positionMs", 0L);
        boolean autoPlay = call.getBoolean("autoPlay", true);

        mainHandler.post(() -> {
            try {
                if (player == null) {
                    trackSelector = new DefaultTrackSelector(getContext());

                    // Configure DefaultHttpDataSource.Factory with allowCrossProtocolRedirects(true)
                    // and User-Agent 'Mozilla/5.0 (Linux; Android) EndlessStream/1.0'
                    DefaultHttpDataSource.Factory httpDataSourceFactory = new DefaultHttpDataSource.Factory()
                            .setUserAgent("Mozilla/5.0 (Linux; Android) EndlessStream/1.0")
                            .setAllowCrossProtocolRedirects(true)
                            .setConnectTimeoutMs(15000)
                            .setReadTimeoutMs(15000);

                    DefaultDataSource.Factory dataSourceFactory = new DefaultDataSource.Factory(getContext(), httpDataSourceFactory);
                    DefaultMediaSourceFactory mediaSourceFactory = new DefaultMediaSourceFactory(dataSourceFactory);

                    player = new ExoPlayer.Builder(getContext())
                            .setMediaSourceFactory(mediaSourceFactory)
                            .setTrackSelector(trackSelector)
                            .build();

                    playerView = new PlayerView(getContext());
                    playerView.setPlayer(player);
                    playerView.setUseController(false); // Seamless living Apple TV+ React controls
                    playerView.setBackgroundColor(Color.BLACK);

                    player.addListener(new Player.Listener() {
                        @Override
                        public void onPlaybackStateChanged(int playbackState) {
                            JSObject data = new JSObject();
                            data.put("state", playbackState);
                            data.put("isBuffering", playbackState == Player.STATE_BUFFERING);
                            data.put("isEnded", playbackState == Player.STATE_ENDED);
                            data.put("isReady", playbackState == Player.STATE_READY);
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

                        @Override
                        public void onPlayerError(PlaybackException error) {
                            JSObject data = new JSObject();
                            data.put("errorCode", error.errorCode);
                            data.put("errorMessage", error.getMessage() != null ? error.getMessage() : "Playback error");
                            notifyListeners("playerError", data);
                        }
                    });
                }

                // Fix view hierarchy and transparency: Ensure playerView is added to root properly
                // Check playerView.getParent() before addView so it never throws IllegalStateException
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
                    ViewGroup root = (ViewGroup) getBridge().getWebView().getParent();
                    if (root != null && playerView != null) {
                        if (playerView.getParent() != null && playerView.getParent() != root) {
                            ((ViewGroup) playerView.getParent()).removeView(playerView);
                        }
                        if (playerView.getParent() == null) {
                            root.addView(playerView, 0, new FrameLayout.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT
                            ));
                        }
                    }
                }

                if (playerView != null) {
                    playerView.setVisibility(View.VISIBLE);
                    playerView.setAlpha(1.0f);
                }

                MediaItem mediaItem = MediaItem.fromUri(Uri.parse(finalUrl));
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
                ret.put("url", finalUrl);
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
            if (playerView != null) {
                playerView.setVisibility(View.VISIBLE);
            }
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
            }
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
                player.seekTo(Math.max(0, positionMs));
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        float vol = call.getFloat("volume", 1.0f);
        mainHandler.post(() -> {
            if (player != null) {
                player.setVolume(Math.max(0.0f, Math.min(1.0f, vol)));
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
                int state = player.getPlaybackState();
                boolean isPlaying = player.isPlaying();
                boolean isBuffering = (state == Player.STATE_BUFFERING);
                long buffered = player.getBufferedPosition();

                ret.put("currentTime", pos >= 0 ? pos / 1000.0 : 0);
                ret.put("duration", dur > 0 && dur != C.TIME_UNSET ? dur / 1000.0 : 0);
                ret.put("isPlaying", isPlaying);
                ret.put("isBuffering", isBuffering);
                ret.put("buffered", buffered >= 0 ? buffered / 1000.0 : 0);
                ret.put("playbackState", state);
            } else {
                ret.put("currentTime", 0);
                ret.put("duration", 0);
                ret.put("isPlaying", false);
                ret.put("isBuffering", false);
                ret.put("buffered", 0);
                ret.put("playbackState", Player.STATE_IDLE);
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
            if (player != null && targetIndex < cachedAudioTracks.size()) {
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
                player.stop();
                player.release();
                player = null;
            }
            if (playerView != null) {
                playerView.setVisibility(View.GONE);
                ViewGroup parent = (ViewGroup) playerView.getParent();
                if (parent != null) {
                    parent.removeView(playerView);
                }
                playerView = null;
            }
            cachedAudioTracks.clear();
            // Restore default opaque WebView background
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().setBackgroundColor(Color.BLACK);
            }
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        mainHandler.post(() -> {
            if (player != null) {
                player.stop();
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
        });
        super.handleOnDestroy();
    }
}
