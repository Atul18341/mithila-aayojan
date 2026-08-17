import { AttendeeCategory } from '@/lib/db';

export interface FoodConfig {
  enabled: boolean;
  strategy?: 'complimentary' | 'coupon-based' | 'paid-buffet' | 'self-arranged';
  vendorDetails?: string;
  availableForAll: 'yes' | 'no';
  allowedCategories?: AttendeeCategory[] | string[];
}

export function checkFoodAccess(
  category: AttendeeCategory | string | undefined | null,
  foodConfig?: FoodConfig | null
): boolean {
  if (!foodConfig || !foodConfig.enabled) {
    return false;
  }

  // If food is provided to everyone registered
  if (foodConfig.availableForAll === 'yes') {
    return true;
  }

  if (!category) {
    return false;
  }

  // Parse allowedCategories safely if stored as a string or array
  let allowed: string[] = [];
  if (Array.isArray(foodConfig.allowedCategories)) {
    allowed = foodConfig.allowedCategories;
  } else if (typeof foodConfig.allowedCategories === 'string') {
    try {
      const parsed = JSON.parse(foodConfig.allowedCategories);
      allowed = Array.isArray(parsed) ? parsed : [];
    } catch {
      allowed = [];
    }
  }

  return allowed.includes(category);
}