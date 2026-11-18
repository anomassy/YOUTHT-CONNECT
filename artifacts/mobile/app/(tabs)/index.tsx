import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useListDevotionals, useListEvents } from '@workspace/api-client-react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useApp();
  const { user } = useAuth();
  const { data: devotionalsData } = useListDevotionals();
  const { data: eventsData } = useListEvents();

  const todayStr = new Date().toISOString().split('T')[0];
  const todaysDevotion = devotionalsData?.devotionals.find(d => d.publishDate === todayStr)
    ?? devotionalsData?.devotionals[0];
  const upcomingEvent = eventsData?.events[0];

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomPad = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.navy as string, colors.navyLight as string]}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.appName, { color: colors.gold as string }]}>Youth Connect</Text>
            <Text style={[styles.appTagline, { color: 'rgba(255,255,255,0.7)' }]}>
              Ruwa City Youth
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => router.push('/profile')}
              style={[styles.avatarBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
            >
              <Feather name="user" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View style={[styles.welcomeRow, { backgroundColor: 'rgba(201,168,76,0.2)' }]}>
          <MaterialCommunityIcons name="hand-wave" size={20} color={colors.gold as string} />
          <Text style={[styles.welcomeText, { color: '#fff' }]}>
            Welcome back, {user?.firstName ?? 'friend'}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Today's Devotion Banner */}
        {todaysDevotion && (
          <Pressable
            onPress={() => router.push('/(tabs)/devotion')}
            style={[styles.devotionCard, { backgroundColor: colors.card }]}
          >
            <View style={styles.devotionCardHeader}>
              <View style={[styles.devotionBadge, { backgroundColor: colors.goldLight as string }]}>
                <Feather name="book-open" size={14} color={colors.gold as string} />
                <Text style={[styles.devotionBadgeText, { color: colors.goldDark as string }]}>
                  Today's Devotion
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.devotionTitle, { color: colors.primary }]}>
              {todaysDevotion.title}
            </Text>
            <Text style={[styles.devotionVerse, { color: colors.gold as string }]}>
              {todaysDevotion.scriptureRef}
            </Text>
            <Text style={[styles.devotionPreview, { color: colors.mutedForeground }]} numberOfLines={3}>
              {todaysDevotion.scriptureText}
            </Text>
          </Pressable>
        )}

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Quick Access
        </Text>
        <View style={styles.quickGrid}>
          <QuickCard
            icon="message-circle"
            label="Community"
            sub="Chat & ask the pastor"
            color={colors.primary}
            onPress={() => router.push('/(tabs)/community')}
            colors={colors}
          />
          <QuickCard
            icon="heart"
            label="Prayer"
            sub="Prayer room"
            color={'#E11D48'}
            onPress={() => router.push('/(tabs)/prayer')}
            colors={colors}
          />
          <QuickCard
            icon="book"
            label="Sabbath School"
            sub="Quarterly lessons"
            color={'#0EA5E9'}
            onPress={() => router.push('/reading-plans')}
            colors={colors}
          />
          <QuickCard
            icon="calendar"
            label="Events"
            sub="What's coming up"
            color={'#059669'}
            onPress={() => router.push('/events')}
            colors={colors}
          />
        </View>

        {/* Upcoming Event */}
        {upcomingEvent && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Upcoming Event
            </Text>
            <Pressable onPress={() => router.push('/events')} style={[styles.serviceCard, { backgroundColor: colors.card }]}>
              <LinearGradient
                colors={[colors.navy as string, colors.navyLight as string]}
                style={styles.serviceCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.serviceCardContent}>
                  <Text style={styles.serviceTitle}>{upcomingEvent.title}</Text>
                  {upcomingEvent.description ? (
                    <Text style={styles.serviceTheme} numberOfLines={1}>{upcomingEvent.description}</Text>
                  ) : null}
                  <View style={styles.serviceDetails}>
                    <View style={styles.serviceDetailRow}>
                      <Feather name="calendar" size={13} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.serviceDetailText}>
                        {new Date(upcomingEvent.startsAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {upcomingEvent.location ? (
                      <View style={styles.serviceDetailRow}>
                        <Feather name="map-pin" size={13} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.serviceDetailText}>{upcomingEvent.location}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.serviceCardRight}>
                  <View
                    style={[
                      styles.rsvpBtn,
                      {
                        backgroundColor: upcomingEvent.isRsvped ? colors.gold as string : 'rgba(255,255,255,0.2)',
                        borderColor: colors.gold as string,
                      },
                    ]}
                  >
                    <Text style={[styles.rsvpText, { color: upcomingEvent.isRsvped ? colors.navy as string : '#fff' }]}>
                      {upcomingEvent.isRsvped ? "You're going" : 'View'}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          </>
        )}

        {/* Admin Access */}
        {isAdmin && (
          <Pressable
            onPress={() => router.push('/admin')}
            style={[styles.adminBtn, { backgroundColor: colors.goldLight as string, borderColor: colors.gold as string }]}
          >
            <Feather name="settings" size={16} color={colors.goldDark as string} />
            <Text style={[styles.adminBtnText, { color: colors.goldDark as string }]}>
              Admin Panel
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

interface QuickCardProps {
  icon: string;
  label: string;
  sub: string;
  color: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}

function QuickCard({ icon, label, sub, color, onPress, colors }: QuickCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickCard,
        { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: color + '18' }]}>
        <Feather name={icon as any} size={22} color={color} />
      </View>
      <Text style={[styles.quickLabel, { color: colors.foreground }]}>{label}</Text>
      <Text style={[styles.quickSub, { color: colors.mutedForeground }]}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  appName: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  appTagline: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  welcomeText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  devotionCard: { borderRadius: 16, padding: 18, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  devotionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  devotionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  devotionBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  devotionTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 4, letterSpacing: -0.3 },
  devotionVerse: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 10 },
  devotionPreview: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 14, letterSpacing: -0.2 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  quickCard: { width: '47%', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  quickIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickLabel: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  quickSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  serviceCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  serviceCardGradient: { flexDirection: 'row', padding: 18, justifyContent: 'space-between' },
  serviceCardContent: { flex: 1 },
  serviceTitle: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  serviceTheme: { color: 'rgba(201,168,76,0.9)', fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 12, fontStyle: 'italic' },
  serviceDetails: { gap: 6 },
  serviceDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  serviceDetailText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  serviceCardRight: { alignItems: 'center', justifyContent: 'center', paddingLeft: 12, gap: 8 },
  rsvpBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  rsvpText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  adminBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12, justifyContent: 'center' },
  adminBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});
