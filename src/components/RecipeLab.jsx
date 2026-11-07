import RecipeLabMobile from './RecipeLabMobile.jsx';

// RecipeLab is a thin alias for RecipeLabMobile. Web and iOS share the same
// 3-zone layout (taste wheel, notebook, suggestion drawer). The `isMobile`
// prop is accepted for backwards-compatibility but ignored.
export default function RecipeLab({ fullData, initialIngredient, initialIngredients, initialMode, handoff, userProfile, onFindCocktail, onFindSauce, onFindWine, onOpenCookbook }) {
  return (
    <RecipeLabMobile
      fullData={fullData}
      initialIngredient={initialIngredient}
      initialIngredients={initialIngredients}
      initialMode={initialMode}
      handoff={handoff}
      userProfile={userProfile}
      onFindCocktail={onFindCocktail}
      onFindSauce={onFindSauce}
      onFindWine={onFindWine}
      onOpenCookbook={onOpenCookbook}
    />
  );
}
