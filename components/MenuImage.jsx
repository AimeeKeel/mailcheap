"use client";

import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import { AlignCenter, AlignLeft, AlignRight, Trash2 } from "lucide-react";
import { ButtonFormat, getBody } from "@/components/MenuFormat";

const OPTIONS = { placement: "top", offset: 8, flip: true, shift: { padding: 8 } };

// Over a selected picture: where it sits in the column (lib/editor-image.js), and a way to remove it.
export default function MenuImage({ editor }) {
	const align = useEditorState({ editor, selector: ({ editor: current }) => current.getAttributes("image").align ?? "center" });

	function setAlign(value) {
		editor.chain().focus().updateAttributes("image", { align: value }).run();
	}

	return (
		<BubbleMenu editor={editor} pluginKey="imageMenu" shouldShow={isImageSelected} appendTo={getBody} options={OPTIONS} className="z-50">
			<div className="flex items-center gap-0.5 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
				{ALIGNMENTS.map(({ value, label, icon: Icon }) => (
					<ButtonFormat key={value} label={label} isActive={align === value} onClick={() => setAlign(value)}>
						<Icon />
					</ButtonFormat>
				))}
				<span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
				<ButtonFormat label="Delete image" onClick={() => editor.chain().focus().deleteSelection().run()}>
					<Trash2 />
				</ButtonFormat>
			</div>
		</BubbleMenu>
	);
}

function isImageSelected({ editor, state }) {
	return editor.isEditable && state.selection instanceof NodeSelection && state.selection.node.type.name === "image";
}

const ALIGNMENTS = [
	{ value: "left", label: "Align left", icon: AlignLeft },
	{ value: "center", label: "Center", icon: AlignCenter },
	{ value: "right", label: "Align right", icon: AlignRight },
];
