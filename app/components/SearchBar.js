import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Pressable, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SPACING } from '../../constants/theme';

const { width } = Dimensions.get('window');

const SEARCH_CATEGORIES = [
  { label: 'Learning & Assessment', value: 'learning-assessment', icon: '📚' },
  { label: 'Skills Learning', value: 'skills-learning', icon: '🛠️' },
  { label: 'Students Profile', value: 'students-profile', icon: '👤' },
  { label: 'Counselling', value: 'counselling', icon: '🤝' },
  { label: 'Psychometric Assessment', value: 'psychometric-assessment', icon: '🧠' },
  { label: 'Subject & Career', value: 'subject-career', icon: '📋' },
  { label: 'Competitive Examination', value: 'competitive-examination', icon: '🏆' },
  { label: 'AI/Robotics & Coding', value: 'coding-ai-robotics', icon: '🤖' },
  { label: 'Language Learning', value: 'language-learning', icon: '🌐' },
  { label: 'Global Opportunities', value: 'global-opportunities', icon: '🌍' },
  { label: 'Progress Tracking', value: 'progress-tracking', icon: '📊' },
  { label: 'Shreyartha Store', value: 'store', icon: '🛒' },
];

const ROUTE_MAP = {
  'learning-assessment': 'learning-assessment',
  'skills-learning': 'skills-learning',
  'students-profile': 'students-profile',
  'counselling': 'counselling',
  'psychometric-assessment': 'psychometric-assessment',
  'subject-career': 'subject-career',
  'competitive-examination': 'competitive-examination',
  'coding-ai-robotics': 'coding-ai-robotics',
  'language-learning': 'language-learning',
  'global-opportunities': 'global-opportunities',
  'progress-tracking': 'progress-tracking',
  'store': 'store',
};

export default function SearchBar() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  const filteredCategories = searchTerm.length > 0
    ? SEARCH_CATEGORIES.filter((cat) =>
        cat.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : SEARCH_CATEGORIES;

  const handleCategorySelect = (category) => {
    setSelectedCategory(category.label);
    setSearchTerm(category.label);
    setIsDropdownOpen(false);

    const slug = ROUTE_MAP[category.value];
    if (slug) {
      router.push(`/pages/${slug}`);
    }
  };

  const handleSearchSubmit = () => {
    if (searchTerm.trim()) {
      const matched = SEARCH_CATEGORIES.find(
        (c) => c.label.toLowerCase() === searchTerm.trim().toLowerCase()
      );
      if (matched) {
        const slug = ROUTE_MAP[matched.value];
        if (slug) {
          router.push(`/pages/${slug}`);
        }
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        {/* Categories Dropdown Button */}
        <TouchableOpacity
          style={styles.categoryBtn}
          onPress={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <Text style={styles.categoryBtnText} numberOfLines={1}>
            {selectedCategory || 'Categories'}
          </Text>
          <Text style={[styles.arrow, isDropdownOpen && styles.arrowOpen]}>
            ▼
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Search Input */}
        <TextInput
          style={styles.searchInput}
          placeholder="Explore Yourself"
          placeholderTextColor="#aaa"
          value={searchTerm}
          onChangeText={(text) => {
            setSearchTerm(text);
            if (text.length > 0) setIsDropdownOpen(true);
          }}
          onFocus={() => setIsDropdownOpen(true)}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
        />

        {/* Search Button */}
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearchSubmit}>
          <Text style={styles.searchBtnText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown */}
      {isDropdownOpen && (
        <View style={styles.dropdown}>
          {filteredCategories.length > 0 ? (
            <ScrollView
              style={styles.dropdownList}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
>
              {filteredCategories.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.dropdownItem,
                    selectedCategory === item.label && styles.dropdownItemSelected,
                  ]}
                  onPress={() => handleCategorySelect(item)}
                >
                  <Text style={styles.dropdownItemIcon}>{item.icon}</Text>
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedCategory === item.label && styles.dropdownItemTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>No matching categories</Text>
            </View>
          )}
        </View>
      )}

      {/* Backdrop to close dropdown when tapping outside */}
      {isDropdownOpen && (
        <Pressable
          style={styles.backdrop}
          onPress={() => setIsDropdownOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    zIndex: 999,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 12,
    elevation: 4,
    overflow: 'visible',
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  categoryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
    maxWidth: 90,
  },
  arrow: {
    fontSize: 8,
    color: '#888',
  },
  arrowOpen: {
    transform: [{ rotate: '180deg' }],
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  searchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchBtnText: {
    fontSize: 18,
  },
  dropdown: {
    position: 'absolute',
    top: 62,
    left: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 8,
    zIndex: 1000,
  },
  dropdownList: {
    paddingVertical: 8,
    maxHeight: 320,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    gap: 12,
  },
  dropdownItemSelected: {
    backgroundColor: '#fff0f4',
  },
  dropdownItemIcon: {
    fontSize: 18,
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  dropdownItemTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  noResults: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#999',
    fontStyle: 'italic',
    fontSize: 14,
  },
  backdrop: {
    position: 'absolute',
    top: 70,
    left: -width,
    right: -width,
    height: 2000,
    zIndex: 998,
  },
});