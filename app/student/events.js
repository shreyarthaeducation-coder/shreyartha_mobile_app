// app/student/events.js
// Native Events & Info screen — full-featured Events page for the student panel.
// Mirrors the website's Events section with: list, filters/search, event detail,
// register/cancel registration, and "My Events" tab.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STUDENT } from '../../constants/theme';
import { studentService } from '../../services/studentService';

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: 'all', label: 'All Events' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'my', label: 'My Events' },
];

const CATEGORY_COLORS = {
  workshop: '#4F46E5',
  seminar: '#06b6d4',
  webinar: '#10b981',
  competition: '#f59e0b',
  cultural: '#f43f5e',
  sports: '#8b5cf6',
  academic: '#3b82f6',
  orientation: '#14b8a6',
  default: '#4F46E5',
};

function categoryColor(cat) {
  const key = (cat || 'default').toLowerCase();
  return Object.keys(CATEGORY_COLORS).find((k) => key.includes(k))
    ? CATEGORY_COLORS[Object.keys(CATEGORY_COLORS).find((k) => key.includes(k))]
    : CATEGORY_COLORS.default;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const str = (v, fallback = '') => String(v ?? fallback).trim();

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return str(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return str(dateStr);
  }
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

function formatDateTime(dateStr) {
  const date = formatDate(dateStr);
  const time = formatTime(dateStr);
  if (date && time) return `${date} • ${time}`;
  return date || time || '';
}

function isUpcoming(event) {
  const dateStr = event?.date || event?.startDate || event?.eventDate || event?.scheduledAt;
  if (!dateStr) return true;
  try {
    return new Date(dateStr) >= new Date();
  } catch {
    return true;
  }
}

function extractEvents(data) {
  return arr(
    data?.events
    || data?.items
    || data?.data
    || (Array.isArray(data) ? data : []),
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterTab({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.filterTab, active && styles.filterTabActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusBadge({ event }) {
  const registered = event?.isRegistered || event?.registered || event?.userRegistered;
  const status = event?.status || event?.registrationStatus || '';
  const full = status.toLowerCase() === 'full' || event?.isFull || event?.capacityFull;
  const cancelled = status.toLowerCase() === 'cancelled' || status.toLowerCase() === 'canceled';
  const upcoming = isUpcoming(event);

  if (registered) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#10b98122' }]}>
        <Text style={[styles.statusText, { color: '#10b981' }]}>✓ Registered</Text>
      </View>
    );
  }
  if (cancelled) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#f43f5e22' }]}>
        <Text style={[styles.statusText, { color: '#f43f5e' }]}>Cancelled</Text>
      </View>
    );
  }
  if (full) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#f59e0b22' }]}>
        <Text style={[styles.statusText, { color: '#f59e0b' }]}>Full</Text>
      </View>
    );
  }
  if (!upcoming) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
        <Text style={[styles.statusText, { color: STUDENT.textMuted }]}>Ended</Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusBadge, { backgroundColor: '#4F46E522' }]}>
      <Text style={[styles.statusText, { color: STUDENT.accent }]}>Open</Text>
    </View>
  );
}

function EventCard({ event, onPress }) {
  const title = str(event?.title || event?.name || event?.eventName, 'Event');
  const date = event?.date || event?.startDate || event?.eventDate || event?.scheduledAt;
  const location = str(event?.location || event?.venue || event?.place || event?.address);
  const mode = str(event?.mode || event?.type || '');
  const isOnline = mode.toLowerCase().includes('online') || mode.toLowerCase().includes('virtual');
  const isOffline = mode.toLowerCase().includes('offline') || mode.toLowerCase().includes('in-person');
  const category = str(event?.category || event?.eventType || event?.type);
  const description = str(event?.description || event?.shortDescription || event?.summary);
  const imageUri = str(event?.image || event?.banner || event?.thumbnail || event?.imageUrl);
  const color = categoryColor(category);

  return (
    <TouchableOpacity style={styles.eventCard} onPress={() => onPress(event)} activeOpacity={0.88}>
      {/* Banner image */}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.eventBanner} resizeMode="cover" />
      ) : (
        <View style={[styles.eventBannerFallback, { backgroundColor: color + '33' }]}>
          <Text style={styles.eventBannerIcon}>🎪</Text>
        </View>
      )}

      <View style={styles.eventCardBody}>
        {/* Title row */}
        <View style={styles.eventTitleRow}>
          <Text style={styles.eventTitle} numberOfLines={2}>{title}</Text>
          <StatusBadge event={event} />
        </View>

        {/* Date & mode */}
        <View style={styles.eventMetaRow}>
          {date ? (
            <View style={styles.eventMetaChip}>
              <Text style={styles.eventMetaIcon}>🗓</Text>
              <Text style={styles.eventMetaText}>{formatDateTime(date)}</Text>
            </View>
          ) : null}
          {mode ? (
            <View style={[styles.eventMetaChip, { backgroundColor: isOnline ? '#06b6d422' : isOffline ? '#10b98122' : '#4F46E522' }]}>
              <Text style={styles.eventMetaIcon}>{isOnline ? '💻' : isOffline ? '📍' : '📌'}</Text>
              <Text style={[styles.eventMetaText, { color: isOnline ? '#06b6d4' : isOffline ? '#10b981' : STUDENT.textSecondary }]}>
                {mode}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Location */}
        {location ? (
          <View style={styles.eventLocationRow}>
            <Text style={styles.eventMetaIcon}>📍</Text>
            <Text style={styles.eventLocation} numberOfLines={1}>{location}</Text>
          </View>
        ) : null}

        {/* Description */}
        {description ? (
          <Text style={styles.eventDesc} numberOfLines={2}>{description}</Text>
        ) : null}

        {/* Category + capacity */}
        <View style={styles.eventFooter}>
          {category ? (
            <View style={[styles.categoryBadge, { backgroundColor: color + '22', borderColor: color + '44' }]}>
              <Text style={[styles.categoryText, { color }]}>{category}</Text>
            </View>
          ) : null}
          {(event?.capacity || event?.maxCapacity) ? (
            <Text style={styles.capacityText}>
              {`${event?.registeredCount || event?.registrations || 0} / ${event?.capacity || event?.maxCapacity} seats`}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Event Detail Modal ───────────────────────────────────────────────────────

function EventDetailModal({ event, visible, onClose, onRegisterChange }) {
  const [loading, setLoading] = useState(false);
  const [registrationState, setRegistrationState] = useState(null); // null = use event prop

  const effectiveEvent = registrationState !== null
    ? { ...event, isRegistered: registrationState }
    : event;

  const isRegistered = effectiveEvent?.isRegistered || effectiveEvent?.registered || effectiveEvent?.userRegistered;
  const title = str(event?.title || event?.name || event?.eventName, 'Event');
  const date = event?.date || event?.startDate || event?.eventDate || event?.scheduledAt;
  const endDate = event?.endDate || event?.endTime;
  const location = str(event?.location || event?.venue || event?.place || event?.address);
  const mode = str(event?.mode || event?.type || '');
  const isOnline = mode.toLowerCase().includes('online') || mode.toLowerCase().includes('virtual');
  const category = str(event?.category || event?.eventType || event?.type);
  const description = str(event?.description || event?.fullDescription || event?.details);
  const organizer = str(event?.organizer || event?.organizerName || event?.hostedBy || event?.createdBy);
  const imageUri = str(event?.image || event?.banner || event?.thumbnail || event?.imageUrl);
  const onlineLink = str(event?.onlineLink || event?.meetingLink || event?.joinUrl || event?.link);
  const color = categoryColor(category);
  const upcoming = isUpcoming(event);
  const status = str(event?.status || event?.registrationStatus).toLowerCase();
  const isFull = status === 'full' || event?.isFull;
  const isCancelled = status === 'cancelled' || status === 'canceled';

  // Agenda / schedule
  const agenda = arr(event?.agenda || event?.schedule || event?.sessions);
  // Speakers
  const speakers = arr(event?.speakers || event?.presenters || event?.panelists);
  // Attachments
  const attachments = arr(event?.attachments || event?.resources || event?.files);
  // Tags
  const tags = arr(event?.tags || event?.topics);

  const handleRegister = useCallback(async () => {
    if (!event?.id && !event?.eventId) return;
    const eventId = event?.id || event?.eventId;
    setLoading(true);
    try {
      await studentService.registerForEvent(eventId);
      setRegistrationState(true);
      onRegisterChange?.();
      Alert.alert('Registered!', 'You have successfully registered for this event.');
    } catch (err) {
      Alert.alert('Registration Failed', err?.message || 'Could not register. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [event, onRegisterChange]);

  const handleCancel = useCallback(async () => {
    if (!event?.id && !event?.eventId) return;
    const eventId = event?.id || event?.eventId;
    Alert.alert(
      'Cancel Registration',
      'Are you sure you want to cancel your registration for this event?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await studentService.cancelEventRegistration(eventId);
              setRegistrationState(false);
              onRegisterChange?.();
              Alert.alert('Cancelled', 'Your registration has been cancelled.');
            } catch (err) {
              Alert.alert('Error', err?.message || 'Could not cancel registration. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  }, [event, onRegisterChange]);

  const handleJoin = useCallback(() => {
    if (onlineLink) {
      Linking.openURL(onlineLink).catch(() =>
        Alert.alert('Error', 'Could not open the meeting link.'),
      );
    }
  }, [onlineLink]);

  const handleShare = useCallback(() => {
    const shareText = `${title}\n${date ? formatDateTime(date) : ''}\n${location || ''}`.trim();
    Alert.alert('Share Event', shareText);
  }, [title, date, location]);

  if (!event) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalRoot} edges={['top', 'left', 'right']}>
        {/* Modal header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} activeOpacity={0.7}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalHeaderTitle} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn} activeOpacity={0.7}>
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Banner */}
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.detailBanner} resizeMode="cover" />
          ) : (
            <View style={[styles.detailBannerFallback, { backgroundColor: color + '33' }]}>
              <Text style={styles.detailBannerIcon}>🎪</Text>
            </View>
          )}

          {/* Title + status */}
          <View style={styles.detailTitleBlock}>
            <Text style={styles.detailTitle}>{title}</Text>
            <StatusBadge event={effectiveEvent} />
          </View>

          {/* Key info chips */}
          <View style={styles.detailInfoGrid}>
            {date ? (
              <View style={styles.detailInfoChip}>
                <Text style={styles.detailInfoIcon}>🗓</Text>
                <View>
                  <Text style={styles.detailInfoLabel}>Date & Time</Text>
                  <Text style={styles.detailInfoValue}>{formatDateTime(date)}</Text>
                  {endDate ? <Text style={styles.detailInfoValue}>Ends: {formatDateTime(endDate)}</Text> : null}
                </View>
              </View>
            ) : null}

            {(location || mode) ? (
              <View style={styles.detailInfoChip}>
                <Text style={styles.detailInfoIcon}>{isOnline ? '💻' : '📍'}</Text>
                <View>
                  <Text style={styles.detailInfoLabel}>{isOnline ? 'Online Event' : 'Venue'}</Text>
                  {location ? <Text style={styles.detailInfoValue}>{location}</Text> : null}
                  {mode ? <Text style={styles.detailInfoValue}>{mode}</Text> : null}
                </View>
              </View>
            ) : null}

            {organizer ? (
              <View style={styles.detailInfoChip}>
                <Text style={styles.detailInfoIcon}>👤</Text>
                <View>
                  <Text style={styles.detailInfoLabel}>Organizer</Text>
                  <Text style={styles.detailInfoValue}>{organizer}</Text>
                </View>
              </View>
            ) : null}

            {(event?.capacity || event?.maxCapacity) ? (
              <View style={styles.detailInfoChip}>
                <Text style={styles.detailInfoIcon}>👥</Text>
                <View>
                  <Text style={styles.detailInfoLabel}>Capacity</Text>
                  <Text style={styles.detailInfoValue}>
                    {`${event?.registeredCount || event?.registrations || 0} / ${event?.capacity || event?.maxCapacity} seats`}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Tags */}
          {tags.length > 0 ? (
            <View style={styles.tagsRow}>
              {tags.map((tag, i) => (
                <View key={i} style={styles.tagChip}>
                  <Text style={styles.tagText}>{str(tag?.name || tag)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Description */}
          {description ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>About This Event</Text>
              <Text style={styles.detailDesc}>{description}</Text>
            </View>
          ) : null}

          {/* Agenda / Schedule */}
          {agenda.length > 0 ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Schedule / Agenda</Text>
              {agenda.map((item, i) => (
                <View key={i} style={styles.agendaRow}>
                  {(item?.time || item?.startTime) ? (
                    <Text style={styles.agendaTime}>{str(item?.time || item?.startTime)}</Text>
                  ) : (
                    <View style={styles.agendaDot} />
                  )}
                  <View style={styles.agendaContent}>
                    <Text style={styles.agendaTitle}>{str(item?.title || item?.activity || item?.name || `Session ${i + 1}`)}</Text>
                    {(item?.description || item?.speaker) ? (
                      <Text style={styles.agendaDesc}>{str(item?.description || item?.speaker)}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* Speakers */}
          {speakers.length > 0 ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Speakers / Presenters</Text>
              {speakers.map((sp, i) => (
                <View key={i} style={styles.speakerRow}>
                  {(sp?.avatar || sp?.photo || sp?.image) ? (
                    <Image source={{ uri: str(sp?.avatar || sp?.photo || sp?.image) }} style={styles.speakerAvatar} />
                  ) : (
                    <View style={styles.speakerAvatarFallback}>
                      <Text style={styles.speakerAvatarText}>{str(sp?.name || sp?.speakerName || `S${i + 1}`).charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.speakerInfo}>
                    <Text style={styles.speakerName}>{str(sp?.name || sp?.speakerName || `Speaker ${i + 1}`)}</Text>
                    {(sp?.designation || sp?.title || sp?.bio) ? (
                      <Text style={styles.speakerDesig}>{str(sp?.designation || sp?.title || sp?.bio)}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* Attachments */}
          {attachments.length > 0 ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Attachments & Resources</Text>
              {attachments.map((att, i) => {
                const url = str(att?.url || att?.link || att?.fileUrl);
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.attachmentRow}
                    onPress={() => url && Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open the attachment.'))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.attachmentIcon}>📎</Text>
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {str(att?.name || att?.title || att?.fileName || `Attachment ${i + 1}`)}
                    </Text>
                    {url ? <Text style={styles.attachmentOpen}>Open</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          <View style={{ height: 32 }} />
        </ScrollView>

        {/* Action buttons */}
        <View style={styles.modalActions}>
          {upcoming && !isCancelled && isOnline && onlineLink ? (
            <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} activeOpacity={0.85}>
              <Text style={styles.joinBtnText}>🔗 Join Online</Text>
            </TouchableOpacity>
          ) : null}

          {upcoming && !isCancelled && !isFull && !isRegistered ? (
            <TouchableOpacity
              style={[styles.registerBtn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.registerBtnText}>Register Now</Text>
              )}
            </TouchableOpacity>
          ) : null}

          {isRegistered && upcoming ? (
            <TouchableOpacity
              style={[styles.cancelRegBtn, loading && styles.btnDisabled]}
              onPress={handleCancel}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#f43f5e" />
              ) : (
                <Text style={styles.cancelRegBtnText}>Cancel Registration</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const [events, setEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myEventsLoading, setMyEventsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const searchTimeout = useRef(null);

  const fetchEvents = useCallback(async (opts = {}) => {
    const { silent = false, filter, search, category } = opts;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filter && filter !== 'all' && filter !== 'my') params.filter = filter;
      if (search) params.search = search;
      if (category && category !== 'All') params.category = category;

      const data = await studentService.getEvents(params);
      const list = extractEvents(data);
      setEvents(list);

      // Build category list
      const cats = new Set();
      list.forEach((e) => {
        const c = e?.category || e?.eventType;
        if (c) cats.add(str(c));
      });
      setCategories(['All', ...Array.from(cats)]);
    } catch (err) {
      setError(err?.message || 'Could not load events.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchMyEvents = useCallback(async () => {
    setMyEventsLoading(true);
    try {
      const data = await studentService.getMyEvents();
      setMyEvents(extractEvents(data));
    } catch {
      setMyEvents([]);
    } finally {
      setMyEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents({ filter: activeFilter !== 'my' && activeFilter !== 'all' ? activeFilter : undefined });
    if (activeFilter === 'my') fetchMyEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  // Clean up debounce timer on unmount
  useEffect(() => () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (activeFilter === 'my') {
      fetchMyEvents().finally(() => setRefreshing(false));
    } else {
      fetchEvents({ silent: true, filter: activeFilter !== 'all' ? activeFilter : undefined, search: searchQuery, category: activeCategory !== 'All' ? activeCategory : undefined });
    }
  }, [fetchEvents, fetchMyEvents, activeFilter, searchQuery, activeCategory]);

  const handleSearchChange = useCallback((text) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchEvents({
        filter: activeFilter !== 'my' && activeFilter !== 'all' ? activeFilter : undefined,
        search: text,
        category: activeCategory !== 'All' ? activeCategory : undefined,
      });
    }, 400);
  }, [fetchEvents, activeFilter, activeCategory]);

  const handleFilterChange = useCallback((key) => {
    setActiveFilter(key);
    setSearchQuery('');
    setActiveCategory('All');
    if (key === 'my') {
      fetchMyEvents();
    } else {
      fetchEvents({ filter: key !== 'all' ? key : undefined });
    }
  }, [fetchEvents, fetchMyEvents]);

  const handleCategoryChange = useCallback((cat) => {
    setActiveCategory(cat);
    fetchEvents({
      filter: activeFilter !== 'my' && activeFilter !== 'all' ? activeFilter : undefined,
      search: searchQuery,
      category: cat !== 'All' ? cat : undefined,
    });
  }, [fetchEvents, activeFilter, searchQuery]);

  const openEventDetail = useCallback((event) => {
    setSelectedEvent(event);
    setDetailVisible(true);
  }, []);

  const closeEventDetail = useCallback(() => {
    setDetailVisible(false);
    setSelectedEvent(null);
  }, []);

  const handleRegistrationChange = useCallback(() => {
    // Refresh both lists after registration state change
    fetchEvents({ filter: activeFilter !== 'my' && activeFilter !== 'all' ? activeFilter : undefined, search: searchQuery });
    fetchMyEvents();
  }, [fetchEvents, fetchMyEvents, activeFilter, searchQuery]);

  // Apply client-side filtering for upcoming/past (in case server doesn't filter)
  const displayedEvents = useMemo(() => {
    const source = activeFilter === 'my' ? myEvents : events;
    const q = searchQuery.trim().toLowerCase();
    const catFilter = activeCategory !== 'All' ? activeCategory.toLowerCase() : null;

    return source.filter((e) => {
      // Upcoming / past filter
      if (activeFilter === 'upcoming' && !isUpcoming(e)) return false;
      if (activeFilter === 'past' && isUpcoming(e)) return false;

      // Category filter
      if (catFilter) {
        const cat = str(e?.category || e?.eventType).toLowerCase();
        if (cat !== catFilter) return false;
      }

      // Search filter
      if (q) {
        const title = str(e?.title || e?.name || e?.eventName).toLowerCase();
        const desc = str(e?.description || e?.shortDescription).toLowerCase();
        const loc = str(e?.location || e?.venue).toLowerCase();
        if (!title.includes(q) && !desc.includes(q) && !loc.includes(q)) return false;
      }

      return true;
    });
  }, [events, myEvents, activeFilter, activeCategory, searchQuery]);

  const isLoadingNow = loading || (activeFilter === 'my' && myEventsLoading);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {/* Background glows */}
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Events & Info</Text>
        <Text style={styles.headerSub}>Discover, register & stay updated</Text>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterScrollContent}
      >
        {FILTER_TABS.map((tab) => (
          <FilterTab
            key={tab.key}
            label={tab.label}
            active={activeFilter === tab.key}
            onPress={() => handleFilterChange(tab.key)}
          />
        ))}
      </ScrollView>

      {/* Search bar (not shown for My Events) */}
      {activeFilter !== 'my' ? (
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search events…"
            placeholderTextColor={STUDENT.textMuted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearchChange('')} style={styles.searchClearBtn}>
              <Text style={styles.searchClearText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Category chips (not shown for My Events) */}
      {activeFilter !== 'my' && categories.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
              onPress={() => handleCategoryChange(cat)}
              activeOpacity={0.7}
            >
              <Text style={[styles.categoryChipText, activeCategory === cat && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {/* Content */}
      {isLoadingNow && !refreshing ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={STUDENT.accent} />
          <Text style={styles.loaderText}>Loading events…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={STUDENT.accent}
              colors={[STUDENT.accent]}
            />
          }
        >
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️  {error}</Text>
              <TouchableOpacity
                onPress={() => fetchEvents({ filter: activeFilter !== 'all' && activeFilter !== 'my' ? activeFilter : undefined })}
                style={styles.retryBtn}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {displayedEvents.length > 0 ? (
            displayedEvents.map((event, i) => (
              <EventCard
                key={event?.id || event?.eventId || i}
                event={event}
                onPress={openEventDetail}
              />
            ))
          ) : !error ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🎪</Text>
              <Text style={styles.emptyTitle}>
                {activeFilter === 'my' ? 'No registered events' : 'No events found'}
              </Text>
              <Text style={styles.emptyText}>
                {activeFilter === 'my'
                  ? "You haven't registered for any events yet. Browse upcoming events and register!"
                  : searchQuery
                    ? `No events match "${searchQuery}".`
                    : activeFilter === 'upcoming'
                      ? 'No upcoming events at the moment. Check back soon!'
                      : activeFilter === 'past'
                        ? 'No past events to show.'
                        : 'No events available right now. Check back later!'}
              </Text>
            </View>
          ) : null}

          <View style={{ height: 28 }} />
        </ScrollView>
      )}

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        visible={detailVisible}
        onClose={closeEventDetail}
        onRegisterChange={handleRegistrationChange}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },

  bgGlowOne: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(79,70,229,0.18)',
    top: -80,
    right: -80,
    zIndex: 0,
  },
  bgGlowTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(6,182,212,0.12)',
    bottom: 40,
    left: -80,
    zIndex: 0,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: STUDENT.border,
    zIndex: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: STUDENT.textPrimary, letterSpacing: 0.3 },
  headerSub: { fontSize: 13, color: STUDENT.textMuted, marginTop: 2 },

  // Filter tabs
  filterScroll: { maxHeight: 50, zIndex: 1 },
  filterScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: STUDENT.bgCard,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  filterTabActive: {
    backgroundColor: STUDENT.accent,
    borderColor: STUDENT.accent,
  },
  filterTabText: { fontSize: 13, fontWeight: '600', color: STUDENT.textMuted },
  filterTabTextActive: { color: '#fff' },

  // Search bar
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: STUDENT.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STUDENT.border,
    paddingHorizontal: 12,
    height: 42,
    zIndex: 1,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: STUDENT.textPrimary },
  searchClearBtn: { padding: 4 },
  searchClearText: { fontSize: 13, color: STUDENT.textMuted },

  // Category chips
  categoryScroll: { maxHeight: 44, zIndex: 1 },
  categoryScrollContent: { paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: STUDENT.bgCardAlt,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  categoryChipActive: { backgroundColor: STUDENT.accent, borderColor: STUDENT.accent },
  categoryChipText: { fontSize: 12, fontWeight: '600', color: STUDENT.textMuted },
  categoryChipTextActive: { color: '#fff' },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 1 },
  loaderText: { color: STUDENT.textMuted, fontSize: 14 },

  scroll: { flex: 1, zIndex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  errorBanner: {
    backgroundColor: 'rgba(244,63,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.35)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: { color: '#f43f5e', fontSize: 13, flex: 1 },
  retryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: STUDENT.accent,
    marginLeft: 10,
  },
  retryBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Event card
  eventCard: {
    backgroundColor: STUDENT.bgCard,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: STUDENT.border,
    overflow: 'hidden',
    ...STUDENT.shadow,
  },
  eventBanner: { width: '100%', height: 160 },
  eventBannerFallback: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBannerIcon: { fontSize: 40 },
  eventCardBody: { padding: 14 },

  eventTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  eventTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: STUDENT.textPrimary,
    lineHeight: 21,
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  eventMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  eventMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  eventMetaIcon: { fontSize: 12 },
  eventMetaText: { fontSize: 12, color: STUDENT.textSecondary },

  eventLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  eventLocation: { fontSize: 12, color: STUDENT.textSecondary, flex: 1 },

  eventDesc: {
    fontSize: 13,
    color: STUDENT.textMuted,
    lineHeight: 18,
    marginBottom: 10,
  },

  eventFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryText: { fontSize: 11, fontWeight: '700' },
  capacityText: { fontSize: 11, color: STUDENT.textMuted },

  emptyCard: {
    backgroundColor: STUDENT.bgCard,
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: STUDENT.border,
    marginTop: 16,
  },
  emptyIcon: { fontSize: 46, marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: STUDENT.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 13, color: STUDENT.textMuted, textAlign: 'center', lineHeight: 20 },

  // ── Modal styles ────────────────────────────────────────────────────────────
  modalRoot: { flex: 1, backgroundColor: STUDENT.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: STUDENT.border,
    gap: 12,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: STUDENT.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: { color: STUDENT.textPrimary, fontSize: 14, fontWeight: '700' },
  modalHeaderTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: STUDENT.textPrimary,
  },
  shareBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: STUDENT.bgCard,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  shareBtnText: { fontSize: 12, color: STUDENT.accent, fontWeight: '700' },

  modalScroll: { flex: 1 },
  modalScrollContent: { paddingBottom: 16 },

  detailBanner: { width: '100%', height: 200 },
  detailBannerFallback: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBannerIcon: { fontSize: 56 },

  detailTitleBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: STUDENT.textPrimary, lineHeight: 27 },

  detailInfoGrid: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 12,
  },
  detailInfoChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: STUDENT.bgCard,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  detailInfoIcon: { fontSize: 18, marginTop: 1 },
  detailInfoLabel: { fontSize: 11, color: STUDENT.textMuted, fontWeight: '600', marginBottom: 2 },
  detailInfoValue: { fontSize: 13, color: STUDENT.textSecondary },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: STUDENT.bgCardAlt,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  tagText: { fontSize: 12, color: STUDENT.textSecondary, fontWeight: '600' },

  detailSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: STUDENT.accent,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  detailDesc: {
    fontSize: 14,
    color: STUDENT.textSecondary,
    lineHeight: 21,
  },

  // Agenda
  agendaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  agendaTime: {
    fontSize: 12,
    color: STUDENT.accent,
    fontWeight: '700',
    width: 70,
    paddingTop: 2,
  },
  agendaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: STUDENT.accent,
    marginTop: 6,
    flexShrink: 0,
  },
  agendaContent: { flex: 1 },
  agendaTitle: { fontSize: 13, fontWeight: '700', color: STUDENT.textPrimary, marginBottom: 3 },
  agendaDesc: { fontSize: 12, color: STUDENT.textMuted, lineHeight: 17 },

  // Speakers
  speakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: STUDENT.bgCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  speakerAvatar: { width: 44, height: 44, borderRadius: 22 },
  speakerAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: STUDENT.accent + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerAvatarText: { fontSize: 18, color: STUDENT.accent, fontWeight: '800' },
  speakerInfo: { flex: 1 },
  speakerName: { fontSize: 14, fontWeight: '700', color: STUDENT.textPrimary },
  speakerDesig: { fontSize: 12, color: STUDENT.textMuted, marginTop: 2 },

  // Attachments
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: STUDENT.bgCard,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  attachmentIcon: { fontSize: 18 },
  attachmentName: { flex: 1, fontSize: 13, color: STUDENT.textSecondary },
  attachmentOpen: { fontSize: 12, color: STUDENT.accent, fontWeight: '700' },

  // Modal action buttons
  modalActions: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: STUDENT.border,
    gap: 10,
  },
  registerBtn: {
    backgroundColor: STUDENT.accent,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelRegBtn: {
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#f43f5e',
    backgroundColor: 'rgba(244,63,94,0.08)',
  },
  cancelRegBtnText: { color: '#f43f5e', fontSize: 15, fontWeight: '800' },
  joinBtn: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.6 },
});
