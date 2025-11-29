export function GodotDocsPanel() {
  return (
    <div className="w-full h-full">
      <iframe
        src="https://docs.godotengine.org/en/4.4/tutorials/scripting/gdscript/gdscript_basics.html"
        className="w-full h-full border-0"
        title="Godot 4.4 GDScript Documentation"
        data-testid="iframe-godot-docs"
      />
    </div>
  );
}
