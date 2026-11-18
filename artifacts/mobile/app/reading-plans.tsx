import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import {
  useListReadingPlans,
  useGetReadingProgress,
  useCompleteReadingDay,
} from '@workspace/api-client-react';
import { useAuth } from '@/context/AuthContext';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : '';

type QuarterlyLesson = {
  week: number;
  title: string;
  dateRange: string;
  page: number;
};

type Quarterly = {
  title: string;
  publication: string;
  quarter: string;
  summary: string;
  lessons: QuarterlyLesson[];
};

type LessonInsight = {
  theme: string;
  objective: string;
  prompt: string;
};

const monthIndex: Record<string, number> = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

function parseLessonStart(dateRange: string): Date | null {
  const match = dateRange.match(/([A-Za-z]+)\s+(\d{1,2})/);
  if (!match) return null;
  const month = monthIndex[match[1]];
  const day = Number(match[2]);
  if (month === undefined || Number.isNaN(day)) return null;
  return new Date(2026, month, day);
}

function getCurrentQuarterLesson(lessons: QuarterlyLesson[]): QuarterlyLesson | null {
  if (!lessons.length) return null;
  const today = new Date();
  const current = lessons.reduce<QuarterlyLesson | null>((selected, lesson) => {
    const start = parseLessonStart(lesson.dateRange);
    if (!start) return selected;
    if (today >= start) {
      return lesson;
    }
    return selected;
  }, null);
  return current ?? lessons[0];
}

const lessonInsights: Record<number, LessonInsight> = {
  1: {
    theme: 'God speaks and reveals',
    objective: 'Identify how God communicates truth and calls people into relationship.',
    prompt: 'What does this study suggest about the confidence we can place in God’s word?',
  },
  2: {
    theme: 'The call to listen',
    objective: 'Recognize how God equips and commissions His servants.',
    prompt: 'How does obedience shape a prophetic life?',
  },
  3: {
    theme: 'Prophetic warning and hope',
    objective: 'See how Scripture reveals God’s heart for justice, repentance, and restoration.',
    prompt: 'Where do you notice God’s mercy even in moments of warning?',
  },
  4: {
    theme: 'The message of the prophets',
    objective: 'Compare the witness of the old and new covenant prophets.',
    prompt: 'What stays the same in God’s message across the Bible?',
  },
  5: {
    theme: 'Truth rooted in revelation',
    objective: 'Understand why inspiration matters for faith and obedience.',
    prompt: 'How does revelation shape the way we interpret life and history?',
  },
  6: {
    theme: 'Reading with discernment',
    objective: 'Learn to interpret prophetic passages with humility and Scripture in view.',
    prompt: 'Which principles help you avoid misreading Scripture?',
  },
  7: {
    theme: 'God’s voice in the present',
    objective: 'Reflect on how God still speaks through His word and His leading.',
    prompt: 'Where are you hearing God’s voice most clearly right now?',
  },
  8: {
    theme: 'Understanding the unseen',
    objective: 'Examine how prophetic themes point to God’s larger story.',
    prompt: 'What part of God’s plan becomes clearer as you study prophecy?',
  },
  9: {
    theme: 'Discerning truth',
    objective: 'Identify how to test spiritual claims against God’s word.',
    prompt: 'What helps you stay grounded when messages seem confusing or intense?',
  },
  10: {
    theme: 'Prophecy with purpose',
    objective: 'Connect prophecy to everyday faith, witness, and trust.',
    prompt: 'How does this message strengthen your walk with God?',
  },
  11: {
    theme: 'God at work in history',
    objective: 'See how prophecy reveals God’s sovereign purpose across generations.',
    prompt: 'What hope does God’s sovereignty give you in difficult seasons?',
  },
  12: {
    theme: 'The final promise',
    objective: 'Reflect on the hope and victory promised in the end-time vision.',
    prompt: 'Which promise from this study gives you the greatest confidence today?',
  },
  13: {
    theme: 'Living in the light of prophecy',
    objective: 'Apply the study to prayer, obedience, and faithful living.',
    prompt: 'What one change will help you live out this lesson this week?',
  },
};

export default function ReadingPlansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { data: plansData, isLoading } = useListReadingPlans();
  const { data: progressData, refetch: refetchProgress } = useGetReadingProgress();
  const completeDay = useCompleteReadingDay();
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);
  const [quarterly, setQuarterly] = useState<Quarterly | null>(null);
  const [quarterlyLoading, setQuarterlyLoading] = useState(true);
  const [quarterlyError, setQuarterlyError] = useState('');

  const plans = plansData?.plans ?? [];
  const completedDayIds = new Set((progressData?.progress ?? []).filter(p => p.completed).map(p => p.planDayId));
  const currentLesson = quarterly ? getCurrentQuarterLesson(quarterly.lessons) : null;
  const currentInsight = currentLesson ? lessonInsights[currentLesson.week] : null;
  const bottomPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  useEffect(() => {
    if (!token) return;
    let active = true;
    async function loadQuarterly() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/reading-plans/quarterly`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Could not load the quarterly schedule.');
        if (active) {
          setQuarterly(result.quarterly as Quarterly);
          setQuarterlyError('');
        }
      } catch (error) {
        if (active) {
          setQuarterlyError(error instanceof Error ? error.message : 'Could not load the quarterly schedule.');
        }
      } finally {
        if (active) setQuarterlyLoading(false);
      }
    }
    void loadQuarterly();
    return () => { active = false; };
  }, [token]);

  async function handleCompleteDay(dayId: number) {
    if (completedDayIds.has(dayId)) return;
    await completeDay.mutateAsync({ dayId });
    await refetchProgress();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <Text style={[styles.pageTitle, { color: colors.primary }]}>Sabbath School Lessons</Text>
        <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
          Seventh-day Adventist quarterly Bible study
        </Text>
      </View>
      <View style={[styles.quarterlyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.quarterlyEyebrow, { color: colors.goldDark as string }]}>
          {quarterly?.quarter || 'QUARTERLY STUDY'}
        </Text>
        <Text style={[styles.quarterlyTitle, { color: colors.primary }]}>
          {quarterly?.title || 'The Gift of Prophecy'}
        </Text>
        <Text style={[styles.planDesc, { color: colors.mutedForeground }]}>
          {quarterly?.publication || 'Adult Sabbath School Bible Study Guide'}
          {quarterly?.summary ? ` · ${quarterly.summary}` : ''}
        </Text>
        {quarterlyLoading ? (
          <Text style={[styles.quarterlyMessage, { color: colors.mutedForeground }]}>Loading quarterly lessons…</Text>
        ) : quarterlyError ? (
          <Text accessibilityRole="alert" style={[styles.quarterlyMessage, { color: colors.destructive as string }]}>
            {quarterlyError}
          </Text>
        ) : quarterly?.lessons.length ? (
          <>
            {currentLesson && currentInsight ? (
              <View style={[styles.currentLesson, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.currentLessonLabel, { color: colors.goldDark as string }]}>Current focus</Text>
                <Text style={[styles.currentLessonTitle, { color: colors.foreground }]}>
                  Week {currentLesson.week}: {currentLesson.title}
                </Text>
                <Text style={[styles.currentLessonDate, { color: colors.mutedForeground }]}>{currentLesson.dateRange}</Text>
                <View style={styles.insightGrid}>
                  <View style={[styles.insightCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.insightLabel, { color: colors.mutedForeground }]}>Theme</Text>
                    <Text style={[styles.insightText, { color: colors.foreground }]}>{currentInsight.theme}</Text>
                  </View>
                  <View style={[styles.insightCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.insightLabel, { color: colors.mutedForeground }]}>Objective</Text>
                    <Text style={[styles.insightText, { color: colors.foreground }]}>{currentInsight.objective}</Text>
                  </View>
                  <View style={[styles.insightCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.insightLabel, { color: colors.mutedForeground }]}>Reflection</Text>
                    <Text style={[styles.insightText, { color: colors.foreground }]}>{currentInsight.prompt}</Text>
                  </View>
                </View>
              </View>
            ) : null}
            <View style={[styles.quarterlyLessons, { borderTopColor: colors.border }]}>
              {quarterly.lessons.map((lesson) => (
                <View key={lesson.week} style={[styles.quarterlyLesson, { borderBottomColor: colors.border }]}>
                  <View style={[styles.weekNumber, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.weekNumberText, { color: colors.primary }]}>{lesson.week}</Text>
                  </View>
                  <View style={styles.lessonInfo}>
                    <Text style={[styles.lessonTitle, { color: colors.foreground }]}>{lesson.title}</Text>
                    <Text style={[styles.lessonDate, { color: colors.mutedForeground }]}>{lesson.dateRange}</Text>
                  </View>
                  <Text style={[styles.lessonPage, { color: colors.mutedForeground }]}>p. {lesson.page}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.quarterlyNote, { color: colors.mutedForeground }]}>
              Use your authorized quarterly edition for the full lesson text.
            </Text>
          </>
        ) : (
          <Text style={[styles.quarterlyMessage, { color: colors.mutedForeground }]}>
            No lessons are available for this quarterly.
          </Text>
        )}
      </View>
      {isLoading && <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 40 }}>Loading…</Text>}
      {!isLoading && plans.length === 0 && (
        <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 40 }}>No reading plans yet.</Text>
      )}
      {plans.map(plan => {
        const doneCount = plan.days.filter(d => completedDayIds.has(d.id)).length;
        const expanded = expandedPlanId === plan.id;
        return (
          <View key={plan.id} style={[styles.planCard, { backgroundColor: colors.card }]}>
            <Pressable onPress={() => setExpandedPlanId(expanded ? null : plan.id)} style={styles.planHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.planTitle, { color: colors.primary }]}>{plan.title}</Text>
                {plan.description ? (
                  <Text style={[styles.planDesc, { color: colors.mutedForeground }]}>{plan.description}</Text>
                ) : null}
                <View style={[styles.progressBarBg, { backgroundColor: colors.secondary }]}>
                  <View style={[styles.progressBarFill, { backgroundColor: colors.gold as string, width: `${plan.days.length ? (doneCount / plan.days.length) * 100 : 0}%` }]} />
                </View>
                <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
                  {doneCount} of {plan.days.length} days complete
                </Text>
              </View>
              <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.mutedForeground} />
            </Pressable>

            {expanded && (
              <View style={styles.daysList}>
                {plan.days.map(day => {
                  const done = completedDayIds.has(day.id);
                  return (
                    <Pressable
                      key={day.id}
                      onPress={() => handleCompleteDay(day.id)}
                      style={[styles.dayRow, { borderTopColor: colors.border }]}
                    >
                      <View style={[styles.dayCheck, { backgroundColor: done ? colors.success as string : colors.secondary, borderColor: done ? colors.success as string : colors.border }]}>
                        {done && <Feather name="check" size={13} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dayLabel, { color: colors.foreground }]}>Day {day.dayNumber} — {day.passage}</Text>
                        {day.reflection ? (
                          <Text style={[styles.dayReflection, { color: colors.mutedForeground }]} numberOfLines={2}>{day.reflection}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  pageTitle: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  pageSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4 },
  quarterlyCard: { borderRadius: 16, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  quarterlyEyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, marginBottom: 5 },
  quarterlyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 5 },
  quarterlyMessage: { fontSize: 13, lineHeight: 20, marginTop: 14 },
  currentLesson: { borderRadius: 12, padding: 12, marginTop: 14, borderWidth: 1 },
  currentLessonLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  currentLessonTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 4 },
  currentLessonDate: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  insightGrid: { marginTop: 12, gap: 8 },
  insightCard: { borderRadius: 10, padding: 10, borderWidth: 1 },
  insightLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  insightText: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 4, lineHeight: 18 },
  quarterlyLessons: { marginTop: 14, borderTopWidth: 1 },
  quarterlyLesson: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  weekNumber: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  weekNumberText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  lessonInfo: { flex: 1, gap: 3 },
  lessonTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  lessonDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  lessonPage: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  quarterlyNote: { fontSize: 11, lineHeight: 16, marginTop: 12 },
  planCard: { borderRadius: 16, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  planDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 10, lineHeight: 19 },
  progressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressBarFill: { height: 6, borderRadius: 3 },
  progressText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  daysList: { marginTop: 14 },
  dayRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  dayCheck: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, marginTop: 2 },
  dayLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  dayReflection: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
