import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { signInGuest, signInWithEmail, signOutUser, signUpWithEmail, subscribeToAuth } from './lib/auth';
import { loadStudyState, saveStudyState } from './lib/persistence';

const TIMER_PRESETS = [25, 30, 45, 60, 120];
const MASCOTS = ['Teddy', 'Panda', 'Cat', 'Dog', 'Frog'];
const PLANTS = ['Monstera', 'Bonsai', 'Sunflower', 'Fern'];

const starterMaterial = `Break material into small sections, listen closely, then explain it back in your own words. Strong study sessions are built on repetition, focus, and active recall.`;

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
}

function chunkText(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > 120 && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function getPlantStage(progress) {
  if (progress >= 0.9) return 'Bloomed';
  if (progress >= 0.6) return 'Growing';
  if (progress >= 0.3) return 'Sprouting';
  return 'Seedling';
}

export default function App() {
  const [materialTitle, setMaterialTitle] = useState('Biology Review');
  const [studyText, setStudyText] = useState(starterMaterial);
  const [selectedTimer, setSelectedTimer] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [selectedMascot, setSelectedMascot] = useState(MASCOTS[0]);
  const [selectedPlant, setSelectedPlant] = useState(PLANTS[0]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [authUser, setAuthUser] = useState(null);
  const [authStatus, setAuthStatus] = useState('Local preview mode');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const chunks = useMemo(() => chunkText(studyText), [studyText]);
  const progress = chunks.length ? (currentChunkIndex + 1) / chunks.length : 0;
  const plantStage = getPlantStage(progress);

  useEffect(() => {
    let unsubscribe = () => {};

    async function connectAuth() {
      unsubscribe = await subscribeToAuth((user, isConfigured) => {
        setAuthUser(user);
        setAuthReady(true);
        if (!isConfigured) {
          setAuthStatus('Add Expo Firebase config to enable shared accounts');
          return;
        }
        setAuthStatus(user ? 'Account connected' : 'Cloud sync available');
      });
    }

    connectAuth();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setSecondsLeft(selectedTimer * 60);
  }, [selectedTimer]);

  useEffect(() => {
    if (!isTimerRunning) return undefined;

    const interval = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setIsTimerRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning]);

  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;
    async function hydrate() {
      const saved = await loadStudyState(authUser);
      if (!saved || cancelled) return;

      setMaterialTitle(saved.materialTitle || 'Biology Review');
      setStudyText(saved.sourceText || starterMaterial);
      setSelectedTimer(saved.activeMinutes || 25);
      setSecondsLeft(saved.secondsLeft || 25 * 60);
      setSelectedMascot(MASCOTS.includes(saved.selectedMascot) ? saved.selectedMascot : MASCOTS[0]);
      setSelectedPlant(PLANTS.includes(saved.selectedPlant) ? saved.selectedPlant : PLANTS[0]);
      setCurrentChunkIndex(typeof saved.currentChunkIndex === 'number' ? saved.currentChunkIndex : 0);
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [authReady, authUser]);

  useEffect(() => {
    if (!authReady) return;

    saveStudyState(
      {
        materialTitle,
        sourceText: studyText,
        activeMinutes: selectedTimer,
        secondsLeft,
        selectedMascot,
        selectedPlant,
        currentChunkIndex,
      },
      authUser
    );
  }, [authReady, authUser, currentChunkIndex, materialTitle, secondsLeft, selectedMascot, selectedPlant, selectedTimer, studyText]);

  const recentMaterials = [
    { title: materialTitle, label: `${chunks.length || 1} chunks ready` },
    { title: 'Chemistry Flash Notes', label: 'Recall loop pending' },
    { title: 'History Timeline', label: 'Weak areas detected' },
  ];

  async function handleEmailAuth(mode) {
    if (!authEmail.trim() || authPassword.length < 6) {
      setAuthStatus('Use a valid email and a password with at least 6 characters');
      return;
    }

    setAuthBusy(true);
    const action = mode === 'signup' ? signUpWithEmail : signInWithEmail;
    const result = await action(authEmail.trim(), authPassword);
    if (result.ok) {
      setAuthStatus(mode === 'signup' ? 'Account created' : 'Signed in successfully');
      setAuthPassword('');
    } else if (result.reason === 'missing-config') {
      setAuthStatus('Add Expo Firebase config to enable accounts');
    } else {
      setAuthStatus(mode === 'signup' ? 'Account creation failed' : 'Sign-in failed');
    }
    setAuthBusy(false);
  }

  async function handleGuestAuth() {
    setAuthBusy(true);
    const result = await signInGuest();
    setAuthStatus(result.ok ? 'Guest cloud sync connected' : 'Guest sign-in failed');
    setAuthBusy(false);
  }

  async function handleSignOut() {
    setAuthBusy(true);
    const result = await signOutUser();
    setAuthStatus(result.ok ? 'Signed out. Local preview mode' : 'Sign-out failed');
    setAuthBusy(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>StudyBRO Mobile</Text>
          <Text style={styles.heroTitle}>Your study companion, now touch-first.</Text>
          <Text style={styles.heroCopy}>
            This mobile shell mirrors the web app flow and is ready for background audio, notifications, and synced
            progress.
          </Text>

          <View style={styles.actionRow}>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Start Study</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setIsTimerRunning(true)}>
              <Text style={styles.secondaryButtonText}>Start Focus</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Today</Text>
            <Text style={styles.cardValue}>{chunks.length}</Text>
            <Text style={styles.cardHint}>Study chunks prepared</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Focus</Text>
            <Text style={styles.cardValue}>{formatTime(secondsLeft)}</Text>
            <Text style={styles.cardHint}>{selectedTimer}-minute session</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Plant</Text>
            <Text style={styles.cardValue}>{plantStage}</Text>
            <Text style={styles.cardHint}>{selectedPlant}</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelEyebrow}>Account</Text>
            <Text style={styles.panelTitle}>Use the same StudyBRO on phone and web</Text>
          </View>
          <Text style={styles.helperText}>{authStatus}</Text>
          <TextInput
            style={styles.input}
            value={authEmail}
            onChangeText={setAuthEmail}
            placeholder="student@example.com"
            placeholderTextColor="#6f8595"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            value={authPassword}
            onChangeText={setAuthPassword}
            placeholder="Minimum 6 characters"
            placeholderTextColor="#6f8595"
            secureTextEntry
          />
          <View style={styles.actionRow}>
            <Pressable style={styles.primaryButton} onPress={() => handleEmailAuth('signup')} disabled={authBusy || Boolean(authUser)}>
              <Text style={styles.primaryButtonText}>Create Account</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => handleEmailAuth('signin')} disabled={authBusy || Boolean(authUser)}>
              <Text style={styles.secondaryButtonText}>Sign In</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handleGuestAuth} disabled={authBusy || Boolean(authUser)}>
              <Text style={styles.secondaryButtonText}>Guest</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handleSignOut} disabled={authBusy || !authUser}>
              <Text style={styles.secondaryButtonText}>Sign Out</Text>
            </Pressable>
          </View>
          <Text style={styles.helperText}>
            {authUser
              ? `Signed in as ${authUser.email || `guest-${authUser.uid.slice(0, 8)}`}`
              : 'Once Firebase is configured, these accounts let the same study progress load on mobile and web.'}
          </Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelEyebrow}>Content</Text>
            <Text style={styles.panelTitle}>Quick mobile capture</Text>
          </View>
          <TextInput
            style={styles.input}
            value={materialTitle}
            onChangeText={setMaterialTitle}
            placeholder="Material title"
            placeholderTextColor="#6f8595"
          />
          <TextInput
            style={styles.textarea}
            multiline
            value={studyText}
            onChangeText={setStudyText}
            placeholder="Paste class notes here..."
            placeholderTextColor="#6f8595"
          />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelEyebrow}>Focus Timer</Text>
            <Text style={styles.panelTitle}>Tap-friendly session presets</Text>
          </View>

          <View style={styles.chipWrap}>
            {TIMER_PRESETS.map((minutes) => (
              <Pressable
                key={minutes}
                style={[styles.chip, minutes === selectedTimer && styles.activeChip]}
                onPress={() => setSelectedTimer(minutes)}
              >
                <Text style={[styles.chipText, minutes === selectedTimer && styles.activeChipText]}>{minutes} min</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.primaryButton} onPress={() => setIsTimerRunning(true)}>
              <Text style={styles.primaryButtonText}>Resume</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setIsTimerRunning(false)}>
              <Text style={styles.secondaryButtonText}>Pause</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelEyebrow}>Companion</Text>
            <Text style={styles.panelTitle}>Mascot and plant preview</Text>
          </View>

          <View style={styles.companionRow}>
            <View style={styles.companionCard}>
              <Text style={styles.companionLabel}>Mascot</Text>
              <Text style={styles.companionValue}>{selectedMascot}</Text>
              <Text style={styles.cardHint}>Ready to cheer you on</Text>
            </View>
            <View style={styles.companionCard}>
              <Text style={styles.companionLabel}>Plant</Text>
              <Text style={styles.companionValue}>{selectedPlant}</Text>
              <Text style={styles.cardHint}>{plantStage}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
            {MASCOTS.map((mascot) => (
              <Pressable
                key={mascot}
                style={[styles.selector, mascot === selectedMascot && styles.activeSelector]}
                onPress={() => setSelectedMascot(mascot)}
              >
                <Text style={styles.selectorText}>{mascot}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
            {PLANTS.map((plant) => (
              <Pressable
                key={plant}
                style={[styles.selector, plant === selectedPlant && styles.activeSelector]}
                onPress={() => setSelectedPlant(plant)}
              >
                <Text style={styles.selectorText}>{plant}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelEyebrow}>Recent Materials</Text>
            <Text style={styles.panelTitle}>Built for sync with the web app</Text>
          </View>

          {recentMaterials.map((item, index) => (
            <Pressable
              key={`${item.title}-${index}`}
              style={styles.recentItem}
              onPress={() => setCurrentChunkIndex(index % Math.max(chunks.length, 1))}
            >
              <View>
                <Text style={styles.recentTitle}>{item.title}</Text>
                <Text style={styles.recentSubtitle}>{item.label}</Text>
              </View>
              <Text style={styles.recentAction}>Open</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#081019',
  },
  container: {
    padding: 20,
    gap: 18,
    backgroundColor: '#081019',
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: '#12202d',
    borderWidth: 1,
    borderColor: 'rgba(142, 227, 176, 0.14)',
    gap: 12,
  },
  eyebrow: {
    color: '#ffca7a',
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  heroTitle: {
    color: '#eff6f9',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroCopy: {
    color: '#95a9b8',
    fontSize: 15,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  primaryButton: {
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: '#8ee3b0',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0a1a12',
    fontWeight: '800',
  },
  secondaryButton: {
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: '#182734',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryButtonText: {
    color: '#eff6f9',
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 100,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#0f1b27',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  cardLabel: {
    color: '#7f95a5',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  cardValue: {
    color: '#eff6f9',
    fontSize: 22,
    fontWeight: '800',
  },
  cardHint: {
    color: '#8ea3b3',
    fontSize: 13,
    lineHeight: 18,
  },
  panel: {
    borderRadius: 26,
    padding: 18,
    backgroundColor: '#0f1822',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 14,
  },
  helperText: {
    color: '#8ea3b3',
    lineHeight: 20,
  },
  panelHeader: {
    gap: 4,
  },
  panelEyebrow: {
    color: '#ffca7a',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  panelTitle: {
    color: '#eff6f9',
    fontSize: 20,
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#152330',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#eff6f9',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  textarea: {
    minHeight: 130,
    backgroundColor: '#152330',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#eff6f9',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    textAlignVertical: 'top',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#152330',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  activeChip: {
    backgroundColor: 'rgba(142, 227, 176, 0.16)',
    borderColor: 'rgba(142, 227, 176, 0.36)',
  },
  chipText: {
    color: '#d9e4eb',
    fontWeight: '700',
  },
  activeChipText: {
    color: '#8ee3b0',
  },
  companionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  companionCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#152330',
    gap: 6,
  },
  companionLabel: {
    color: '#7f95a5',
    textTransform: 'uppercase',
    fontWeight: '700',
    fontSize: 12,
  },
  companionValue: {
    color: '#eff6f9',
    fontSize: 20,
    fontWeight: '800',
  },
  selectorRow: {
    gap: 10,
    paddingRight: 10,
  },
  selector: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#152330',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  activeSelector: {
    borderColor: 'rgba(255, 202, 122, 0.35)',
    backgroundColor: 'rgba(255, 202, 122, 0.12)',
  },
  selectorText: {
    color: '#eff6f9',
    fontWeight: '700',
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#152330',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  recentTitle: {
    color: '#eff6f9',
    fontWeight: '700',
    fontSize: 16,
  },
  recentSubtitle: {
    color: '#8ea3b3',
    marginTop: 4,
  },
  recentAction: {
    color: '#8ee3b0',
    fontWeight: '800',
  },
});
