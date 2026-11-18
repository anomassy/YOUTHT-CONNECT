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
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useApp();
  const { user } = useAuth();
  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === 'web' ? 84 : 0);

  const items = [
    { icon: 'book', label: 'Sabbath School Lessons', sub: 'Seventh-day Adventist quarterly study', route: '/reading-plans', color: '#0EA5E9', bg: '#E0F2FE' },
    { icon: 'calendar', label: 'Events', sub: 'Upcoming services & gatherings', route: '/events', color: '#059669', bg: '#DCFCE7' },
    { icon: 'music', label: 'Gospel Music', sub: 'Worship anywhere', route: '/(tabs)/music', color: '#7C3AED', bg: '#EDE9FE' },
    { icon: 'user', label: 'Profile', sub: 'Your account & settings', route: '/profile', color: colors.primary as string, bg: colors.secondary as string },
  ];

  if (isAdmin) {
    items.push({ icon: 'shield', label: 'Admin Panel', sub: 'Manage devotions, events & questions', route: '/admin', color: colors.goldDark as string, bg: colors.goldLight as string });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.navy as string, colors.navyLight as string]}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <Text style={[styles.headerTitle, { color: '#fff' }]}>More</Text>
        <Text style={[styles.headerSub, { color: 'rgba(255,255,255,0.7)' }]}>
          {user ? `${user.firstName} ${user.lastName}` : ''}
        </Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]} showsVerticalScrollIndicator={false}>
        {items.map(item => (
          <Pressable
            key={item.route}
            onPress={() => router.push(item.route as any)}
            style={({ pressed }) => [styles.card, { backgroundColor: colors.card, opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={[styles.cardIcon, { backgroundColor: item.bg }]}>
              <Feather name={item.icon as any} size={22} color={item.color} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={[styles.cardLabel, { color: colors.foreground }]}>{item.label}</Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.sub}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  headerSub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 },
  cardIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  cardSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
