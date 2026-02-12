import React, { useEffect, useMemo, useState } from 'react';

type SoundId = 'none' | 'chime' | 'ding' | 'pop';

const SOUND_URLS: Record<Exclude<SoundId,'none'>, string> = {
  // small, public domain-ish short sounds (can be replaced with your own hosted assets)
  chime: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
  ding: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
  pop: 'https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg'
};

const STORAGE_KEY = 'notif_sound_prefs_v1';

export type NotificationSoundPrefs = {
  enabledTypes: Record<string, boolean>; // per notification.type
  soundId: SoundId;
  volume: number; // 0..1
};

function defaultPrefs(): NotificationSoundPrefs {
  return {
    enabledTypes: {
      file_request_upload: true,
      file_request_fulfilled: true,
      file_request_reopened: true,
      file_request_reassigned: true,
      access_request: true,
    },
    soundId: 'ding',
    volume: 0.6
  };
}

export function loadNotificationSoundPrefs(): NotificationSoundPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs();
    const parsed = JSON.parse(raw);
    return { ...defaultPrefs(), ...parsed, enabledTypes: { ...defaultPrefs().enabledTypes, ...(parsed.enabledTypes || {}) } };
  } catch {
    return defaultPrefs();
  }
}

export function saveNotificationSoundPrefs(prefs: NotificationSoundPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function playNotificationSound(soundId: SoundId, volume: number) {
  if (soundId === 'none') return;
  const url = SOUND_URLS[soundId as Exclude<SoundId,'none'>];
  if (!url) return;
  try {
    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    // best-effort; browsers may block if user hasn't interacted yet
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}

export function NotificationSoundSettings() {
  const [prefs, setPrefs] = useState<NotificationSoundPrefs>(() => loadNotificationSoundPrefs());

  useEffect(() => {
    saveNotificationSoundPrefs(prefs);
  }, [prefs]);

  const soundOptions = useMemo(() => ([
    { id: 'none' as const, label: 'No sound' },
    { id: 'ding' as const, label: 'Ding' },
    { id: 'chime' as const, label: 'Chime' },
    { id: 'pop' as const, label: 'Pop' }
  ]), []);

  const toggleType = (t: string) => {
    setPrefs(prev => ({
      ...prev,
      enabledTypes: { ...prev.enabledTypes, [t]: !prev.enabledTypes[t] }
    }));
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-2">Notification Sounds</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Choose a sound and which notification types should play it.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Sound</label>
          <select
            value={prefs.soundId}
            onChange={(e) => setPrefs(prev => ({ ...prev, soundId: e.target.value as SoundId }))}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700"
          >
            {soundOptions.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>

          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">Volume</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={prefs.volume}
              onChange={(e) => setPrefs(prev => ({ ...prev, volume: Number(e.target.value) }))}
              className="w-full"
            />
          </div>

          <button
            type="button"
            onClick={() => playNotificationSound(prefs.soundId, prefs.volume)}
            className="mt-3 px-3 py-2 text-sm border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Test sound
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Play sound for</label>
          <div className="space-y-2">
            {Object.keys(prefs.enabledTypes).map(t => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!prefs.enabledTypes[t]}
                  onChange={() => toggleType(t)}
                />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
