# GPT Assistant

An infinitely extendable assistant framework to automate your life.

## Pre-Release

**Assistant is currently pre-release!** There is some core functionality, but there's still a long way to go until it's ready to be used. No garuntee of backward's compatibility can be given at this time, as the kinks are worked out and the framework is stress tested. If you're interested in helping out, or testing it pre-release, [send me an email](mailto:aidantilgner02@gmail.com), or hmu some other way for more details.

Check out [the roadmap](https://github.com/QuasarBrains/Assistant/blob/master/Roadmap.md) for more info.

## Description

Assistant is a declarative framework for building out complex, powerful digital assistants. Acting as a wrapper around a language model of choice, most noteably `gpt-4`, or `gpt-3.5-turbo`, the Assistant framework provides additional functionality and utilities to extend the model. Most noteably, the model will have access to [`Services`](https://github.com/QuasarBrains/Assistant/blob/master/documentation/Services.md), [`Events`](https://github.com/QuasarBrains/Assistant/blob/master/documentation/Events.md), and [`Channels`](https://github.com/QuasarBrains/Assistant/blob/master/documentation/Channels.md). Through a combination of these core utilities, your assistant will be able to communicate with you (channels), pay attentiont to the world (events), and take action in any way possible through software (services).

There will be prebuilt services, channels, and events, as well as other helpful functionality to get off the ground easily. However, the infinitely extendable aspect of Assistant is the ability to easily add your own functionality. You can add Channels to let your assistant communicate with you in new ways. Services will let you connect your assistant to any API, shell script, or other application you're willing to build an implementation for. And Events will let you define things that may happen which your assistant should pay attention to, as well as how to react.

## Agents vs Assistants

There are many projects such as [AutoGPT](https://github.com/Significant-Gravitas/Auto-GPT), [Baby AGI](https://github.com/yoheinakajima/babyagi), and others, which employ a concept known as agents. These agents can be described as follows: a program given a goal (or agency), which it will then develop a plan in order to complete, and then use tools at its disposal to follow its plan. There are a lot of lessons to be learned from agents, and its very possible that they might even be employed as part of the project. However, there is a fundamental difference between an agent and an assistant.

An assistant does not have a goal, it has a purpose. It does not have a discrete set of steps in order to fulfill its purpose, but rather must exist in perpetuity, ready to recieve orders, or take initiative, in order to fulfill it. This is the key difference between an agent and an assistant, and why I'm creating this project. An assistant will be capable of dispatching agents, however, the agents ultimately only exist to fulfill one task, hence their "agency". The assistant exists to continuously provide service to the user.

## Example Use

> **Note**
> Code seen here is subject to change as the project progresses towards 1.0.0, some things here may not work as expected. If you have questions please [reach out](mailto:aidantilgner02@gmail.com) to me directly or [leave an issue](https://github.com/QuasarBrains/Assistant/issues/new)!
