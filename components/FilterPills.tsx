import { Theme } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface FilterPillsProps {
    categories: string[];
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
    preferredCategories?: string[];
}

export const FilterPills = ({ categories, selectedCategory, onCategoryChange, preferredCategories = [] }: FilterPillsProps) => {
    const flatListRef = useRef<FlatList>(null);

    // Sort categories to show preferred ones first
    const sortedCategories = [...categories].sort((a, b) => {
        const aIsPreferred = preferredCategories.includes(a);
        const bIsPreferred = preferredCategories.includes(b);
        if (aIsPreferred && !bIsPreferred) return -1;
        if (!aIsPreferred && bIsPreferred) return 1;
        return 0;
    });

    const handlePress = useCallback((category: string, index: number) => {
        if (category !== selectedCategory) {
            Haptics.selectionAsync();
            onCategoryChange(category);
            // Scroll to make selected pill visible
            flatListRef.current?.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.3,
            });
        }
    }, [selectedCategory, onCategoryChange]);

    const renderPill = useCallback(({ item, index }: { item: string; index: number }) => {
        const isSelected = item === selectedCategory;
        return (
            <TouchableOpacity
                onPress={() => handlePress(item, index)}
                activeOpacity={0.7}
                style={[
                    styles.pill,
                    isSelected ? styles.pillSelected : styles.pillUnselected,
                ]}
            >
                <Text
                    style={[
                        styles.pillText,
                        isSelected ? styles.pillTextSelected : styles.pillTextUnselected,
                    ]}
                >
                    {item}
                </Text>
            </TouchableOpacity>
        );
    }, [selectedCategory, handlePress]);

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                horizontal
                data={sortedCategories}
                keyExtractor={(item) => item}
                renderItem={renderPill}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.contentContainer}
                onScrollToIndexFailed={() => {
                    // Fallback for scroll failures
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
    },
    contentContainer: {
        paddingHorizontal: 16,
        gap: 8,
    },
    pill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    pillSelected: {
        backgroundColor: Theme.textPrimary,
        borderColor: Theme.textPrimary,
    },
    pillUnselected: {
        backgroundColor: Theme.bgCard,
        borderColor: Theme.border,
    },
    pillText: {
        fontSize: 14,
        fontWeight: '600',
    },
    pillTextSelected: {
        color: Theme.bgMain,
    },
    pillTextUnselected: {
        color: Theme.textSecondary,
    },
});
