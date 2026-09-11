import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { buildSectionExplanation, sectionsForPortal } from '../../constants/teacherChatbotData';
import * as teacherShreya from '../../services/teacher/shreyaService';


/**
 * Shreya — the teacher's AI companion.
 * Ports frontendmain/src/School/Teacher/components/TeacherChatbot/TeacherChatbot.js.
 *
 * Two layers, exactly as the web:
 *   1. pick a section  → an AI summary + drill-down tiles
 *   2. reach a leaf    → free-text chat grounded in that scope
 *
 * Drill-down is MULTI-LEVEL: a section tile can return class tiles and a class tile can return
 * student tiles. `itemKey`s are opaque pipe-delimited composites (`cs|9|A`, `stu|412`, `hw|88`) —
 * they are passed back to the server untouched and MUST never be parsed here.
 *
 * The web's fixed side panel becomes a full-height modal sheet. Everything else — the option
 * chips, the ⭐ on a selected tile, the typing swap, the **bold** renderer, the history divider —
 * is the same behaviour.
 */

const ASK_ANYTHING = 'Ask me anything';

const botMsg = (text, options) => ({ sender: 'bot', text, options: options || null });
const userMsg = (text) => ({ sender: 'user', text });
const typingMsg = () => ({ sender: 'bot', typing: true });

const CHATBOT_AVATAR = require('../../assets/images/Chatbot.png');

/* ── Bold + newline renderer ──────────────────────────────────────────────────
   The transcript only ever contains `**bold**` and `\n`; the backend prompts emit nothing else.
   Same split the web's renderText() uses. */
function RichLine({ text, style, boldStyle }) {
  const parts = String(text || '').split(/\*\*(.*?)\*\*/g);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={boldStyle}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        ),
      )}
    </Text>
  );
}

/** Three pulsing dots while Shreya thinks — the native form of the web's typing bubble. */
function TypingDots() {
  // Reads the same styles the sheet does. `styles` is no longer a module constant, so this local
  // component has to call the hook rather than close over it.
  const styles = useStyles();
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);

  return (
    <View style={styles.typingRow} accessibilityLabel="Shreya is typing">
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              opacity: value.interpolate({
                inputRange: [0, 1],
                // Staggered so the three dots ripple instead of blinking together.
                outputRange: i === 0 ? [0.3, 1] : i === 1 ? [0.6, 0.6] : [1, 0.3],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function ShreyaChatSheet({
  visible,
  onClose,
  basePath = '/teacher',
  isShreya01 = false,
  /**
   * Portal config. Omitted entirely by the teacher panels, which keep the defaults below — this
   * component was the teacher's before the parent portal needed the same machine.
   *
   * The parent's Shreya is not a lookalike: the backend DTOs are the SAME CLASSES
   * (SectionSummaryRequest, ShreyaReplyResponse, SubTile, ChapterLink all live in one package and
   * serve parent, teacher and student), and the error contract is identical. So only the section
   * data, the transport namespace, the name key and the greeting differ.
   *
   * The sheet takes its COLOUR from the surrounding PaletteContext, not from config — teal inside
   * the teacher shell (usePalette() defaults to PORTALS.school, which this file used to hardcode),
   * purple inside app/parent/_layout.js.
   *
   * @type {{ sections, buildExplanation, service, nameKey, greeting, resolveLink }}
   */
  config,
}) {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const scrollRef = useRef(null);

  const teacherSections = useMemo(() => sectionsForPortal(isShreya01), [isShreya01]);
  const sections = config?.sections || teacherSections;
  const buildExplanation = config?.buildExplanation || buildSectionExplanation;
  const service = config?.service || teacherShreya;
  const nameKey = config?.nameKey || 'schoolUserName';
  /**
   * `(name) => string | Promise<string>`. Both call sites await it, so a portal whose greeting
   * needs more than the stored name — the parent's names the child too — can read storage itself
   * without the sheet knowing which keys that takes. A plain string still awaits to itself.
   */
  const greetingFor =
    config?.greeting ||
    ((name) =>
      `Hi ${name}, I can help you with your classes, students and teaching tools. What would you like to look at?`);
  /**
   * `ChapterLink.route` is NOT the same shape across portals, and getting this wrong produces a
   * button that navigates nowhere.
   *   teacher — TeacherShreyaContextService emits a bare suffix, so basePath + route is the route.
   *   parent  — ParentShreyaContextService emits a full WEB path, PARENT_DASHBOARD_ROUTE +
   *             "/attendance" and friends. Prefixing that with basePath yields
   *             /parent/parent/platform/dashboard/attendance.
   * So each portal says how to turn a server route into a suffix for THIS app, and returning null
   * means "no native screen for that" — the button is dropped rather than pointed somewhere wrong.
   */
  const resolveLink = config?.resolveLink || ((route) => route);

  const toPageLink = useCallback(
    (chapterLink) => {
      if (!chapterLink) return null;
      const suffix = resolveLink(chapterLink.route);
      if (suffix == null) return null;
      return { label: chapterLink.label, suffix };
    },
    [resolveLink],
  );

  const sectionLabels = useMemo(() => sections.map((s) => s.label), [sections]);

  const [messages, setMessages] = useState([]);
  /** loading | greeting | aiThinking | askFollowUp | freeChat */
  const [step, setStep] = useState('loading');

  const [selectedSection, setSelectedSection] = useState(null);
  const [subTiles, setSubTiles] = useState([]);
  const [activeItemKey, setActiveItemKey] = useState(null);

  const [aiHistory, setAiHistory] = useState([]);
  const [sending, setSending] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  /* ── Load the saved transcript on open ──────────────────────────────────── */
  useEffect(() => {
    if (!visible) return undefined;
    let alive = true;

    (async () => {
      setStep('loading');
      const name = (await AsyncStorage.getItem(nameKey)) || 'there';
      const saved = await service.fetchChatHistory();
      if (!alive) return;

      const history = saved.map((m) => ({
        sender: m.role === 'assistant' ? 'bot' : 'user',
        text: m.content,
        history: true,
      }));

      const greetingText = await greetingFor(name);
      if (!alive) return;

      setMessages([
        ...history,
        ...(history.length > 0 ? [{ divider: true }] : []),
        botMsg(greetingText, sectionLabels),
      ]);
      setStep('greeting');
    })();

    return () => {
      alive = false;
    };
    // sectionLabels is derived from a constant list; re-running on open is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const addMessages = useCallback(
    (...msgs) => {
      setMessages((prev) => [...prev, ...msgs]);
      scrollToEnd();
    },
    [scrollToEnd],
  );

  /** Swap the typing bubble for the real reply, so the transcript never keeps a ghost. */
  const replaceTyping = useCallback(
    (...msgs) => {
      setMessages((prev) => [...prev.filter((m) => !m.typing), ...msgs]);
      scrollToEnd();
    },
    [scrollToEnd],
  );

  const resetConversation = useCallback(async () => {
    const name = (await AsyncStorage.getItem(nameKey)) || 'there';
    setMessages([botMsg(await greetingFor(name), sectionLabels)]);
    setStep('greeting');
    setSelectedSection(null);
    setSubTiles([]);
    setActiveItemKey(null);
    setAiHistory([]);
    setSending(false);
    setInputValue('');
    // nameKey and greetingFor now come from `config`, so they belong in the deps — without them a
    // portal switch inside one mounted sheet would reset with the previous portal's greeting.
  }, [sectionLabels, nameKey, greetingFor]);

  const buildFollowUpOptions = useCallback(
    (section, tiles) => [
      ...(tiles || []).map((t) => t.label),
      ASK_ANYTHING,
      `Go to ${section.label}`,
      'Explore another topic',
      'Close',
    ],
    [],
  );

  const enterFreeChat = useCallback(
    (section) => {
      const label = section?.label || 'classes';
      addMessages(
        botMsg(
          `Type your questions below — I'll answer based on your own **${label}** data. You can also use the quick actions under the chat.`,
        ),
      );
      setStep('freeChat');
    },
    [addMessages],
  );

  /* ── Layer 1: a section ─────────────────────────────────────────────────── */
  const handleSectionSelect = useCallback(
    async (label) => {
      const section = sections.find((s) => s.label === label);
      if (!section) return;
      setSelectedSection(section);
      setActiveItemKey(null);
      setAiHistory([]);
      addMessages(userMsg(label), typingMsg());
      setStep('aiThinking');

      let tiles = [];
      let text;
      let link = null;
      try {
        const data = await service.fetchSectionSummary({ sectionKey: section.sectionKey });
        tiles = data?.subTiles || [];
        link = toPageLink(data?.chapterLink);
        // fallback:true means the AI was unreachable but the tiles are still real — show the
        // static copy rather than an error, exactly as the web does.
        text = !data?.fallback && data?.reply ? data.reply : buildExplanation(section);
      } catch {
        text = buildExplanation(section);
      }
      setSubTiles(tiles);
      replaceTyping(
        { ...botMsg(text), pageLink: link },
        botMsg('Want to go deeper?', buildFollowUpOptions(section, tiles)),
      );
      setStep('askFollowUp');
    },
    [sections, addMessages, replaceTyping, buildFollowUpOptions, toPageLink],
  );

  /* ── Multi-level drill: a tile may return more tiles ────────────────────── */
  const handleSubTileSelect = useCallback(
    async (tile) => {
      if (!selectedSection) return;
      setActiveItemKey(tile.key);
      addMessages(userMsg(tile.label), typingMsg());
      setStep('aiThinking');

      let text;
      let link = null;
      let nextTiles = [];
      try {
        const data = await service.fetchSectionSummary({
          sectionKey: selectedSection.sectionKey,
          itemKey: tile.key,
        });
        link = toPageLink(data?.chapterLink);
        nextTiles = data?.subTiles || [];
        text =
          !data?.fallback && data?.reply
            ? data.reply
            : `Let's look at **${tile.label}** — ask me anything about it below!`;
      } catch {
        text = `I couldn't load the analysis for **${tile.label}** right now, but you can still ask me questions about it.`;
      }
      replaceTyping({ ...botMsg(text), pageLink: link });

      if (nextTiles.length > 0) {
        // A deeper level exists (class → students): stay drillable instead of dropping into
        // free chat. This is the behaviour that breaks if an itemKey gets parsed or rewritten.
        setSubTiles(nextTiles);
        addMessages(botMsg('Want to go deeper?', buildFollowUpOptions(selectedSection, nextTiles)));
        setStep('askFollowUp');
      } else {
        enterFreeChat(selectedSection);
      }
    },
    [selectedSection, addMessages, replaceTyping, buildFollowUpOptions, enterFreeChat, toPageLink],
  );

  const goTo = useCallback(
    (suffix) => {
      onClose?.();
      // routeSuffix values line up 1:1 with app/teacher/*.js, so no mapping table is needed.
      router.push(`${basePath}${suffix || ''}`);
    },
    [onClose, router, basePath],
  );

  const handleFollowUpSelect = useCallback(
    (option) => {
      const tile = subTiles.find((t) => t.label === option);
      if (tile) {
        handleSubTileSelect(tile);
        return;
      }

      if (option === ASK_ANYTHING) {
        addMessages(userMsg(option));
        enterFreeChat(selectedSection);
        return;
      }

      addMessages(userMsg(option));

      if (selectedSection && option === `Go to ${selectedSection.label}`) {
        goTo(selectedSection.routeSuffix);
        return;
      }
      if (option === 'Explore another topic') resetConversation();
      else if (option === 'Close') onClose?.();
    },
    [
      subTiles,
      handleSubTileSelect,
      addMessages,
      enterFreeChat,
      selectedSection,
      goTo,
      resetConversation,
      onClose,
    ],
  );

  const handleOptionPress = useCallback(
    (opt) => {
      if (step === 'greeting') handleSectionSelect(opt);
      else if (step === 'askFollowUp') handleFollowUpSelect(opt);
    },
    [step, handleSectionSelect, handleFollowUpSelect],
  );

  /* ── Layer 2: free text ─────────────────────────────────────────────────── */
  const submit = useCallback(async () => {
    const value = inputValue.trim();
    if (!value || step !== 'freeChat' || sending) return;
    setInputValue('');

    const nextHistory = [...aiHistory, { role: 'user', content: value }];
    setAiHistory(nextHistory);
    addMessages(userMsg(value), typingMsg());
    setSending(true);
    try {
      const data = await service.sendChatMessage({
        sectionKey: selectedSection ? selectedSection.sectionKey : null,
        itemKey: activeItemKey,
        messages: nextHistory,
      });
      const reply = data?.reply || "Sorry, I couldn't think that through. Try asking again.";
      setAiHistory((prev) => [...prev, { role: 'assistant', content: reply }]);
      replaceTyping(botMsg(reply));
    } catch (e) {
      // No static fallback exists for free text — a 502 means DeepSeek itself is down.
      replaceTyping(
        botMsg(e?.message || "Sorry, I couldn't think that through. Try asking again."),
      );
    }
    setSending(false);
  }, [
    inputValue,
    step,
    sending,
    aiHistory,
    addMessages,
    replaceTyping,
    selectedSection,
    activeItemKey,
  ]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        // iOS only. On Android softwareKeyboardLayoutMode:"pan" (app.json) already handles this,
        // and adding a KAV on top is what broke the login screens.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.avatar}>
                  <Image source={CHATBOT_AVATAR} style={styles.avatarImg} resizeMode="cover" />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>Shreya – Your AI Companion</Text>
                  <Text style={styles.headerSubtitle}>Your teaching companion</Text>
                </View>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Close Shreya"
              >
                <Ionicons name="close" size={22} color="#ffffff" />
              </Pressable>
            </View>

            {step === 'loading' ? (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={palette.primary} />
                <Text style={styles.loaderText}>Loading your teaching companion…</Text>
              </View>
            ) : (
              <ScrollView
                ref={scrollRef}
                style={styles.flex}
                contentContainerStyle={styles.messages}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {messages.map((msg, idx) => {
                  if (msg.divider) {
                    return (
                      <View key={`d${idx}`} style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>New conversation</Text>
                        <View style={styles.dividerLine} />
                      </View>
                    );
                  }

                  // Options belong to the LAST bot message only — older chip rows are dead
                  // state and tapping one would act on a stale step.
                  const showOptions = msg.options && idx === messages.length - 1;
                  const isUser = msg.sender === 'user';

                  return (
                    <View key={idx} style={styles.group}>
                      <View
                        style={[
                          styles.bubble,
                          isUser ? styles.userBubble : styles.botBubble,
                        ]}
                      >
                        {msg.typing ? (
                          <TypingDots />
                        ) : (
                          <RichLine
                            text={msg.text}
                            style={[styles.bubbleText, isUser && styles.userText]}
                            boldStyle={[styles.bold, isUser && styles.userText]}
                          />
                        )}
                      </View>

                      {msg.pageLink ? (
                        <Pressable
                          onPress={() => goTo(msg.pageLink.suffix)}
                          style={({ pressed }) => [styles.pageLink, pressed && styles.pressed]}
                          accessibilityRole="button"
                        >
                          <Text style={styles.pageLinkText}>
                            {msg.pageLink.label || 'Open Page'} →
                          </Text>
                        </Pressable>
                      ) : null}

                      {showOptions ? (
                        <View style={styles.chips}>
                          {msg.options.map((opt) => {
                            const starred = subTiles.some((t) => t.label === opt && t.selected);
                            return (
                              <Pressable
                                key={opt}
                                onPress={() => handleOptionPress(opt)}
                                style={({ pressed }) => [
                                  styles.chip,
                                  starred && styles.chipStarred,
                                  pressed && styles.pressed,
                                ]}
                                accessibilityRole="button"
                              >
                                <Text style={styles.chipText}>
                                  {starred ? '⭐ ' : ''}
                                  {opt}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Both rows stay mounted for the whole of free-chat mode: unmounting a sibling of a
                focused TextInput is what dismisses the Android keyboard. */}
            {step === 'freeChat' ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.actionRow}
                  contentContainerStyle={styles.actionRowContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {[
                    ['📋 Mark Attendance', '/attendance'],
                    ['📚 Assign Homework', '/homework'],
                    ['📊 My Students', '/student-analytics'],
                  ].map(([label, suffix]) => (
                    <Pressable
                      key={suffix}
                      onPress={() => goTo(suffix)}
                      style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.actionText}>{label}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={resetConversation}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.actionBtnGhost,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.actionText, styles.actionTextGhost]}>↺ Sections</Text>
                  </Pressable>
                </ScrollView>

                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder={`Ask Shreya about your ${
                      selectedSection ? selectedSection.label : 'classes'
                    }…`}
                    placeholderTextColor={SLATE[500]}
                    value={inputValue}
                    onChangeText={setInputValue}
                    onSubmitEditing={submit}
                    returnKeyType="send"
                    editable={!sending}
                    multiline={false}
                    // No autoFocus: the web has it, but autofocus inside an Android Modal
                    // fights the keyboard and is the single most reliable way to reintroduce
                    // the dismiss bug this app spent two sessions fixing.
                  />
                  <Pressable
                    onPress={submit}
                    disabled={!inputValue.trim() || sending}
                    style={({ pressed }) => [
                      styles.sendBtn,
                      (!inputValue.trim() || sending) && styles.sendDisabled,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Send"
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Ionicons name="send" size={19} color="#ffffff" />
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((p) => ({
  flex: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: {
    height: '92%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: p.headerBg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  headerText: { flex: 1 },
  headerTitle: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  headerSubtitle: { fontSize: TYPE.caption, color: 'rgba(255,255,255,0.78)', marginTop: 1 },
  closeBtn: { padding: 4 },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  loaderText: { fontSize: TYPE.body, color: SLATE[500] },

  messages: { padding: SPACING.md, paddingBottom: SPACING.lg },
  group: { marginBottom: 14 },
  bubble: { maxWidth: '88%', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10 },
  botBubble: { alignSelf: 'flex-start', backgroundColor: SLATE[100], borderBottomLeftRadius: 4 },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: p.primary,
    borderBottomRightRadius: 4,
  },
  // NO OPACITY HERE. Restored turns used to render at `opacity: 0.62` to read as "older", which
  // dropped the bot bubble from ~13:1 to about 4.6:1 and the white-on-primary user bubble further
  // still — so the previous conversation, the thing a counsellor scrolls back to actually read, was
  // the least legible text in the sheet. The "New conversation" divider below already separates
  // them, and it does it without costing contrast.
  //
  // If age needs to be clearer, add a timestamp — dimming is not a substitute for a label.
  bubbleText: { fontSize: TYPE.body, lineHeight: leading(TYPE.body), color: SLATE[800] },
  bold: { fontWeight: '700' },
  userText: { color: '#ffffff' },

  typingRow: { flexDirection: 'row', gap: 5, paddingVertical: 4, paddingHorizontal: 2 },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: SLATE[500] },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: SLATE[200] },
  // SLATE[600], not SLATE[400] (2.59:1). This label is now the ONLY thing marking where the
  // restored conversation ends, so it cannot be the faintest text on the screen.
  dividerText: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[600], textTransform: 'uppercase' },

  pageLink: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: p.tint,
  },
  pageLinkText: { fontSize: TYPE.label, fontWeight: '700', color: p.primaryDark },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  chip: {
    borderWidth: 1.4,
    borderColor: p.primary,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  chipStarred: { backgroundColor: p.tint },
  chipText: { fontSize: TYPE.label, fontWeight: '600', color: p.primaryDark },

  actionRow: { flexGrow: 0, borderTopWidth: 1, borderTopColor: SLATE[100] },
  actionRowContent: { gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10 },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  actionBtnGhost: { backgroundColor: SLATE[100] },
  actionText: { fontSize: TYPE.label, fontWeight: '700', color: p.primaryDark },
  actionTextGhost: { color: SLATE[500] },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 26 : 12,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: TYPE.body,
    color: SLATE[800],
    backgroundColor: SLATE[100],
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.primaryDark,
    ...SHADOWS.sm,
  },
  sendDisabled: { backgroundColor: SLATE[300] },
  pressed: { opacity: 0.72 },
}));
