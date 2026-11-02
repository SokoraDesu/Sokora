# Containers

Shared containers (as in Discord containers) to be reused throughout the codebase. For historical reasons they’re named as if they were embeds.

Ignoring `settingsEmbed`, which is an exception within containers AND within the whole project, exempt of many of our code QL standards due to how hard it seemingly is to deliver the best settings experience on Discord… embeds are simple!

They export a single function that takes parameters to build it and an interaction to respond to with it.

Internally, the function to acutally build the embed is separate from the one with the logic to send it, aiding with maintainance.
