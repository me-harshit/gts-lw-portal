import {
    Building2, Home, Dumbbell, Utensils, Croissant, Sofa, Store, ShoppingCart, ShoppingBag,
    Car, Factory, Coffee, Shirt, Package, Hotel, Warehouse, Wrench, Bed, Baby, Dog, Trees,
    Flower2, Building, Landmark, Cake, ChefHat, CookingPot, FolderKanban
} from 'lucide-react';

// Curated set of lucide icons an admin can pick from when creating a project.
// Projects store the icon *name* (a string); we map it back to a component at render time.
export const PROJECT_ICONS = {
    Building2, Home, Dumbbell, Utensils, Croissant, Sofa, Store, ShoppingCart, ShoppingBag,
    Car, Factory, Coffee, Shirt, Package, Hotel, Warehouse, Wrench, Bed, Baby, Dog, Trees,
    Flower2, Building, Landmark, Cake, ChefHat, CookingPot, FolderKanban
};

export const DEFAULT_PROJECT_ICON = 'FolderKanban';
export const PROJECT_ICON_NAMES = Object.keys(PROJECT_ICONS);

// Always returns a valid component (falls back to FolderKanban for unknown / missing names).
export const getProjectIcon = (name) => PROJECT_ICONS[name] || PROJECT_ICONS[DEFAULT_PROJECT_ICON];
