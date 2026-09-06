import sys
import json
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "."))
import prompts

all_prompts = {
    "solo": prompts.solo_prompts_dict if hasattr(prompts, "solo_prompts_dict") else {},
    "couple_man_unseen": prompts.couple_man_unseen_prompts_dict if hasattr(prompts, "couple_man_unseen_prompts_dict") else {},
    "couple_man_seen": prompts.couple_man_seen_prompts_dict if hasattr(prompts, "couple_man_seen_prompts_dict") else {},
    "multiple_women": prompts.multiple_women_prompts_dict if hasattr(prompts, "multiple_women_prompts_dict") else {},
    "multiple_man_unseen": prompts.multiple_man_unseen_prompts_dict if hasattr(prompts, "multiple_man_unseen_prompts_dict") else {},
    "multiple_man_seen": prompts.multiple_man_seen_prompts_dict if hasattr(prompts, "multiple_man_seen_prompts_dict") else {},
    "multistep": prompts.multistep_prompts_dict if hasattr(prompts, "multistep_prompts_dict") else {},
    "vid_solo": prompts.vid_solo_prompts_dict if hasattr(prompts, "vid_solo_prompts_dict") else {},
    "vid_couple": prompts.vid_couple_prompts_dict if hasattr(prompts, "vid_couple_prompts_dict") else {},
    "vid_multiple": prompts.vid_multiple_prompts_dict if hasattr(prompts, "vid_multiple_prompts_dict") else {},
    "vid_environment": prompts.vid_environment_prompts_dict if hasattr(prompts, "vid_environment_prompts_dict") else {},
    "vid_custom": prompts.vid_custom_prompts_dict if hasattr(prompts, "vid_custom_prompts_dict") else {},
    "vid_multistep": prompts.vid_multistep_prompts_dict if hasattr(prompts, "vid_multistep_prompts_dict") else {},
}

out_path = os.path.join(os.path.dirname(__file__), "..", "public", "newgen_prompts.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(all_prompts, f, indent=2, ensure_ascii=False)

print(f"Exported {sum(len(v) for v in all_prompts.values())} prompts across {len(all_prompts)} categories to {out_path}")
