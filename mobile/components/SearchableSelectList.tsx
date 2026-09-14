import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SelectItem, SelectGroup } from '../services/coachMessageService';
import { useLanguage } from '../context/LanguageContext';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../constants/theme';
import AnimatedPressable from './AnimatedPressable';

interface SearchableSelectListProps {
  groups: SelectGroup[];
  metaOptions: readonly SelectItem[];
  selectedKeys: string[];
  onSelectionChange: (keys: string[]) => void;
  otherKey: string;
  otherValue: string;
  onOtherChange: (text: string) => void;
  noneKey: string;
  preferNotKey: string;
  searchPlaceholder: string;
  safetyMessage: string;
  allItemsKey?: string;
}

function toggleKey(keys: string[], key: string, noneKey: string, preferNotKey: string): string[] {
  if (key === noneKey || key === preferNotKey) {
    return [key];
  }
  const hasNone = keys.includes(noneKey);
  const hasPrefer = keys.includes(preferNotKey);
  let base = keys;
  if (hasNone) base = base.filter((k) => k !== noneKey);
  if (hasPrefer) base = base.filter((k) => k !== preferNotKey);
  if (base.includes(key)) {
    return base.filter((k) => k !== key);
  }
  return [...base, key];
}

export default function SearchableSelectList({
  groups,
  metaOptions,
  selectedKeys,
  onSelectionChange,
  otherKey,
  otherValue,
  onOtherChange,
  noneKey,
  preferNotKey,
  searchPlaceholder,
  safetyMessage,
}: SearchableSelectListProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => item.label.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, search]);

  const metaMatches = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return metaOptions.some((m) => m.label.toLowerCase().includes(q));
  }, [search, metaOptions]);

  const showSafety =
    selectedKeys.length > 0 &&
    !selectedKeys.includes(noneKey) &&
    !selectedKeys.includes(preferNotKey);

  return (
    <View style={styles.container}>
      {/* Interactive Search Input */}
      <View style={[styles.searchBarContainer, isFocused && styles.searchBarContainerFocused]}>
        <Ionicons name="search-outline" size={20} color={isFocused ? Colors.primary : '#8FA4AE'} />
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={searchPlaceholder}
        />
        {search.length > 0 && (
          <Pressable
            onPress={() => setSearch('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.clearBtn}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </Pressable>
        )}
      </View>

      {/* Filtered Condition/Allergen Groups */}
      {filteredGroups.map((group) => {
        const selectedInGroupCount = group.items.filter((item) => selectedKeys.includes(item.key)).length;

        return (
          <View key={group.category} style={styles.group}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryLabel}>{group.category}</Text>
              {selectedInGroupCount > 0 && (
                <View style={styles.groupBadge}>
                  <Text style={styles.groupBadgeText}>{selectedInGroupCount}</Text>
                </View>
              )}
            </View>

            {group.items.map((item) => {
              const sel = selectedKeys.includes(item.key);
              return (
                <AnimatedPressable
                  key={item.key}
                  style={[styles.row, sel && styles.rowActive]}
                  onPress={() => onSelectionChange(toggleKey(selectedKeys, item.key, noneKey, preferNotKey))}
                  scaleTo={0.98}
                  hapticStyle="selection"
                  accessibilityLabel={`${item.label}, ${sel ? t('common.selected') : t('common.notSelected')}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: sel }}
                >
                  <View style={[styles.checkbox, sel && styles.checkboxActive]}>
                    {sel && <Ionicons name="checkmark-sharp" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.rowText, sel && styles.rowTextActive]}>{item.label}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        );
      })}

      {/* Meta Options (None, Other, Prefer not to say) */}
      {metaMatches && (
        <View style={styles.group}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryLabel}>{t('common.options') || 'OPTIONS'}</Text>
          </View>
          {metaOptions.map((opt) => {
            const sel = selectedKeys.includes(opt.key);
            return (
              <AnimatedPressable
                key={opt.key}
                style={[styles.row, sel && styles.rowActive]}
                onPress={() => onSelectionChange(toggleKey(selectedKeys, opt.key, noneKey, preferNotKey))}
                scaleTo={0.98}
                hapticStyle="selection"
                accessibilityLabel={`${opt.label}, ${sel ? t('common.selected') : t('common.notSelected')}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: sel }}
              >
                <View style={[styles.checkbox, sel && styles.checkboxActive]}>
                  {sel && <Ionicons name="checkmark-sharp" size={14} color="#FFFFFF" />}
                </View>
                <Text style={[styles.rowText, sel && styles.rowTextActive]}>{opt.label}</Text>
              </AnimatedPressable>
            );
          })}
        </View>
      )}

      {/* "Other" Specify Input */}
      {selectedKeys.includes(otherKey) && (
        <View style={styles.otherInputWrapper}>
          <Text style={styles.otherInputLabel}>{t('common.pleaseSpecify') || 'Please specify:'}</Text>
          <TextInput
            style={styles.otherInput}
            placeholder={t('common.pleaseSpecify') || 'Enter specifics here...'}
            placeholderTextColor="#9CA3AF"
            value={otherValue}
            onChangeText={onOtherChange}
            accessibilityLabel={`${t('common.other')}, ${t('common.pleaseSpecify')}`}
          />
        </View>
      )}

      {/* Medical / Safety Disclaimer Box */}
      {showSafety && (
        <View style={styles.safetyBox}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#B45309" style={styles.safetyIcon} />
          <Text style={styles.safetyText}>{safetyMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EEDECB',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 6,
    gap: 10,
    shadowColor: '#4A2810',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 4,
  },
  searchBarContainerFocused: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0.08,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    paddingVertical: Platform.OS === 'android' ? 6 : 0,
  },
  clearBtn: {
    padding: 4,
  },
  group: {
    marginTop: 6,
    gap: 3,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extrabold,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  groupBadge: {
    backgroundColor: Colors.primaryGlow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F5C6B1',
  },
  groupBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 12,
    backgroundColor: 'transparent',
  },
  rowActive: {
    backgroundColor: '#FFF4EE',
    borderColor: '#F5C6B1',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D7C7B7',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  rowText: {
    fontSize: FontSize.sm + 0.5,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  rowTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  otherInputWrapper: {
    marginTop: 8,
    gap: 6,
  },
  otherInputLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    paddingHorizontal: 4,
  },
  otherInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EEDECB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  safetyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    gap: 10,
  },
  safetyIcon: {
    marginTop: 1,
  },
  safetyText: {
    flex: 1,
    fontSize: FontSize.xs + 0.5,
    color: '#78350F',
    lineHeight: 18,
    fontWeight: FontWeight.medium,
  },
});

