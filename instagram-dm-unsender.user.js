
// ==UserScript==

// @name				instagram-dm-unsender
// @license				MIT
// @copyright				Copyright (c) 2023, Romain Lebesle <oss@thoughtsunificator.me> (https://thoughtsunificator.me)
// @namespace				https://thoughtsunificator.me/
// @author				Romain Lebesle <oss@thoughtsunificator.me> (https://thoughtsunificator.me)
// @homepageURL				https://thoughtsunificator.me/
// @supportURL				https://thoughtsunificator.me/
// @contributionURL				https://thoughtsunificator.me/
// @icon				https://www.instagram.com/favicon.ico
// @version				0.7.2.4
// @updateURL				https://gist.githubusercontent.com/guglielmo-io/e9a1f27a1d8b37743eb29d256c5f32a8/raw/instagram-dm-unsender-fixed.user.js
// @downloadURL				https://gist.githubusercontent.com/guglielmo-io/e9a1f27a1d8b37743eb29d256c5f32a8/raw/instagram-dm-unsender-fixed.user.js
// @description				Simple script to unsend all DMs in a thread on instagram.com
// @run-at				document-end
// @include				/^https://(www\.)?instagram\.com/*/

// ==/UserScript==


(function (exports) {
	'use strict';

	/** @module instagram Helpers to mimick Instagram's look and feel */

	const BUTTON_STYLE = {
		"PRIMARY": "primary",
		"SECONDARY": "secondary",
	};

	/**
	 *
	 * @param {HTMLButtonElement} buttonElement
	 * @param {string}            styleName
	 */
	function applyButtonStyle(buttonElement, styleName) {
		buttonElement.style.fontSize = "var(--system-14-font-size)";
		buttonElement.style.color = "white";
		buttonElement.style.border = "0px";
		buttonElement.style.borderRadius = "8px";
		buttonElement.style.padding = "8px";
		buttonElement.style.fontWeight = "bold";
		buttonElement.style.cursor = "pointer";
		buttonElement.style.lineHeight = "var(--system-14-line-height)";
		if(styleName) {
			buttonElement.style.backgroundColor = `rgb(var(--ig-${styleName}-button))`;
		}
	}

	/** @module menu-button Helpers to create buttons that can be used in IDMU's menu */


	/**
	 *
	 * @param {Document} document
	 * @param {string}   text
	 * @param {string}   styleName
	 * @returns {HTMLButtonElement}
	 */
	function createMenuButtonElement(document, text, styleName) {
		const buttonElement = document.createElement("button");
		buttonElement.textContent = text;
		applyButtonStyle(buttonElement, styleName);
		buttonElement.addEventListener("mouseover", () => {
			buttonElement.style.filter = `brightness(1.15)`;
		});
		buttonElement.addEventListener("mouseout", () => {
			buttonElement.style.filter = ``;
		});
		return buttonElement
	}

	/** @module menu IDMU's main menu */

	/**
	 * @param {Document} document
	 * @returns {HTMLButtonElement}
	 */
	function createMenuElement(document) {
		const menuElement = document.createElement("div");
		menuElement.id = "idmu-menu";
		menuElement.style.top = "20px";
		menuElement.style.right = "430px";
		menuElement.style.position = "fixed";
		menuElement.style.zIndex = 999;
		menuElement.style.display = "flex";
		menuElement.style.gap = "10px";
		menuElement.style.placeItems = "center";
		return menuElement
	}

	/** @module async-events Utils module for finding elements asynchronously in the DOM */

	/**
	 *
	 * @callback getElement
	 * @returns {Element}
	 */

	/**
	 * Run a callback on DOM mutation (addedNode) that tests whether a specific element was found (or was not found)
	 * When the callback returns true the promise is resolved
	 * @param {Element} target
	 * @param {getElement} getElement
	 * @param {AbortController} abortController
	 * @returns {Promise<Element>}
	 * @example
	 * waitForElement(
	 *		body,
	 *		() => body.contains(document.querySelector("button#foo")),
	 *		abortController
	 *	)
	 */
	function waitForElement(target, getElement, abortController) {
		return new Promise((resolve, reject) => {
			let mutationObserver;
			const abortHandler = () => {
				if(mutationObserver) {
					mutationObserver.disconnect();
				}
				reject(new Error(`waitForElement aborted: ${abortController.signal.reason}`));
			};
			abortController.signal.addEventListener("abort", abortHandler);
			let element = getElement();
			if(element) {
				resolve(element);
				abortController.signal.removeEventListener("abort", abortHandler);
			} else {
				mutationObserver = new MutationObserver((mutations, observer) => {
					element = getElement(mutations);
					if(element) {
						observer.disconnect();
						resolve(element);
						abortController.signal.removeEventListener("abort", abortHandler);
					}
				});
				mutationObserver.observe(target, { subtree: true, childList: true });
			}
		})
	}

	/**
	 * Click target and run waitForElement
	 * @param {Element} clickTarget
	 * @param {Element} target
	 * @param {getElement} getElement
	 * @param {AbortController} abortController
	 * @returns {Element|Promise<Element>}
	 * @example
	 * In this case clicking "#foo" button would make "#bar" appear
	 * clickElementAndWaitFor(
	 *		document.querySelector("#foo"),
	 *		body,
	 *		() => body.contains(document.querySelector("#bar")),
	 *		abortController
	 *	)
	 */
	function clickElementAndWaitFor(clickTarget, target, getElement, abortController) {
		const promise = waitForElement(target, getElement, abortController);
		clickTarget.click();
		return getElement() || promise
	}

	/** @module ui-component Base class for any element that is a part of the UI. */


	/**
	 *
	 * @abstract
	 */
	class UIComponent {
		/**
		 *
		 * @param {Element} root
		 * @param {object} identifier
		 */
		constructor(root, identifier={}) {
			this.root = root;
			this.identifier = identifier;
		}

		/**
		 * Alias of dom/async-events#waitForElement
		 * @param {Element} target
		 * @param {function} getElement
		 * @param {AbortController} abortController
		 * @returns {Promise<Element>}
		 */
		waitForElement(target, getElement, abortController) {
			return getElement() || waitForElement(target, getElement, abortController)
		}

		/**
		 * Alias of dom/async-events#clickElementAndWaitFor
		 * @param {Element} clickTarget
		 * @param {Element} target
		 * @param {function} getElement
		 * @param {AbortController} abortController
		 * @returns {Promise<Element>}
		 */
		clickElementAndWaitFor(clickTarget, target, getElement, abortController) {
			return clickElementAndWaitFor(clickTarget, target, getElement, abortController)
		}

	}

	/** Locale-independent patterns for the "Unsend" menu item */
	const UNSEND_TEXT_VARIANTS = [
		"unsend",        // English
		"annulla invio", // Italian
		"retirar",       // Portuguese
		"deshacer",      // Spanish
		"retirer",       // French
		"zurücknehmen",  // German
	];


	/** Represents the description text that is associated with the "..." button that reveals the actions menu */
	const LABEL_PATTERNS = [
		"[aria-label^='See more options for message']",
		"[aria-label*='more options']",
		"[aria-label*='More']",
		"[aria-label*='Altre opzioni']",
		"[aria-label*='opzioni']",
		"[aria-label*='opciones']",
		"[aria-label*='options']",
	];

	/** @module ui-message UI element representing a message */


	/**
	 * Dispatches pointer and mouse hover events on a target element.
	 * Instagram's React uses pointer events internally; mouse events alone are insufficient.
	 *
	 * @param {Element} target
	 */
	function dispatchHoverIn(target) {
		const rect = target.getBoundingClientRect();
		const opts = {
			bubbles: true,
			cancelable: true,
			clientX: rect.x + rect.width / 2,
			clientY: rect.y + rect.height / 2,
			pointerId: 1,
			pointerType: "mouse",
		};
		target.dispatchEvent(new PointerEvent("pointerenter", { ...opts, bubbles: false }));
		target.dispatchEvent(new PointerEvent("pointerover", opts));
		target.dispatchEvent(new PointerEvent("pointermove", opts));
		target.dispatchEvent(new MouseEvent("mouseenter", { ...opts, bubbles: false }));
		target.dispatchEvent(new MouseEvent("mouseover", opts));
		target.dispatchEvent(new MouseEvent("mousemove", opts));
	}

	/**
	 * Dispatches pointer and mouse leave events on a target element.
	 *
	 * @param {Element} target
	 */
	function dispatchHoverOut(target) {
		const rect = target.getBoundingClientRect();
		const opts = {
			bubbles: true,
			cancelable: true,
			clientX: rect.x + rect.width / 2,
			clientY: rect.y + rect.height / 2,
			pointerId: 1,
			pointerType: "mouse",
		};
		target.dispatchEvent(new PointerEvent("pointerout", opts));
		target.dispatchEvent(new PointerEvent("pointerleave", { ...opts, bubbles: false }));
		target.dispatchEvent(new MouseEvent("mouseout", opts));
		target.dispatchEvent(new MouseEvent("mouseleave", { ...opts, bubbles: false }));
	}

	class UIMessage extends UIComponent {

		/**
		 * Dismiss any stale dialog or dropdown left from a previous failed workflow.
		 */
		_dismissStaleOverlays() {
			const doc = this.root.ownerDocument;
			// Close stale confirmation dialogs
			const staleDialog = doc.querySelector("[role=dialog]");
			if (staleDialog) {
				console.debug("Dismissing stale dialog");
				const closeBtn = staleDialog.querySelector("button");
				if (closeBtn) closeBtn.click();
			}
			// Close stale dropdown menus by pressing Escape
			const activeMenu = doc.querySelector("[role=menu], [role=listbox]");
			if (activeMenu) {
				console.debug("Dismissing stale menu via Escape");
				doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			}
		}

		/**
		 * Find the action button within the message row.
		 * Instagram moved aria-label from the button div to a nested SVG/title.
		 * Any match (SVG or div) is walked up to the nearest [role=button] ancestor.
		 *
		 * @param {Element} scope
		 * @returns {Element|null}
		 */
		_findActionButton(scope) {
			for (const sel of LABEL_PATTERNS) {
				const el = scope.querySelector(sel);
				if (el) {
					// Always resolve to a clickable button container
					const btn = el.closest("[role=button]") || el.closest("button");
					if (btn && scope.contains(btn)) return btn
					// el itself is already a button-like element
					if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") return el
				}
			}

			// Fallback: any role=button with aria-haspopup=menu inside the message row
			return scope.querySelector("[role=button][aria-haspopup=menu]")
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<HTMLButtonElement>}
		 */
		async showActionsMenuButton(abortController) {
			console.debug("Workflow step 1 : showActionsMenuButton", this.root);
			this._dismissStaleOverlays();

			// Collect all hoverable ancestors from root down to the message bubble.
			// Instagram React listens at intermediate levels (role=group, flex-end wrapper).
			const hoverTargets = [this.root];
			const collectTargets = (el, depth) => {
				if (depth > 8) return
				for (const child of el.children) {
					hoverTargets.push(child);
					collectTargets(child, depth + 1);
				}
			};
			collectTargets(this.root, 0);

			// Try up to 3 times — hover events can be flaky
			for (let attempt = 0; attempt < 3; attempt++) {
				if (abortController.signal.aborted) return null

				for (const target of hoverTargets) {
					dispatchHoverIn(target);
				}

				await new Promise(resolve => setTimeout(resolve, 100));

				const btn = this._findActionButton(this.root);
				if (btn) {
					console.debug("Workflow step 1 : found action button on attempt", attempt, btn);
					return btn
				}

				console.debug("Workflow step 1 : attempt", attempt, "no button found, retrying...");
				dispatchHoverOut(this.root);
				await new Promise(resolve => setTimeout(resolve, 50));
			}

			// Final fallback: use waitForElement with extended timeout
			const waitAbortController = new AbortController();
			let promiseTimeout;
			const abortHandler = () => {
				waitAbortController.abort("showActionsMenuButton step was aborted by the parent process");
				clearTimeout(promiseTimeout);
			};
			abortController.signal.addEventListener("abort", abortHandler);

			for (const target of hoverTargets) {
				dispatchHoverIn(target);
			}

			try {
				const actionButton = await Promise.race([
					this.waitForElement(
						this.root,
						() => this._findActionButton(this.root),
						waitAbortController
					),
					new Promise((resolve, reject) => {
						promiseTimeout = setTimeout(() => reject("Timeout showActionsMenuButton"), 3000);
					})
				]);

				if (actionButton) {
					return actionButton
				}
				return actionButton
			} finally {
				waitAbortController.abort(); // Aborting without reason because the reason is the error itself
				clearTimeout(promiseTimeout);
				abortController.signal.removeEventListener("abort", abortHandler);
			}
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<boolean>}
		 */
		async hideActionMenuButton(abortController) {
			console.debug("hideActionMenuButton", this.root);
			dispatchHoverOut(this.root);

			const noneEl = this.root.querySelector("[role=none]");
			if (noneEl) {
				dispatchHoverOut(noneEl);
			}

			const waitAbortController = new AbortController();
			let promiseTimeout;
			let resolveTimeout;
			const abortHandler = () => {
				waitAbortController.abort("hideActionMenuButton step was aborted by the parent process");
				clearTimeout(promiseTimeout);
				if (resolveTimeout) {
					resolveTimeout();
				}
			};
			abortController.signal.addEventListener("abort", abortHandler);

			try {
				const result = await Promise.race([
					this.waitForElement(
						this.root,
						() => this._findActionButton(this.root) === null,
						waitAbortController
					),
					new Promise((resolve, reject) => {
						resolveTimeout = resolve;
						promiseTimeout = setTimeout(() => reject("Timeout hideActionMenuButton"), 500);
					})
				]);
				return result
			} finally {
				waitAbortController.abort(); // Aborting without reason because the reason is the error itself
				clearTimeout(promiseTimeout);
				abortController.signal.removeEventListener("abort", abortHandler);
			}
		}

		/**
		 * Opens the actions menu by clicking the action button and waiting for the "Unsend" item.
		 *
		 * @param {HTMLButtonElement} actionButton
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		async openActionsMenu(actionButton, abortController) {
			console.debug("Workflow step 2 : Clicking actionButton and waiting for unsend menu item to appear", actionButton);
			const waitAbortController = new AbortController();
			let promiseTimeout;
			const abortHandler = () => {
				waitAbortController.abort("openActionsMenu step was aborted by the parent process");
				clearTimeout(promiseTimeout);
			};
			abortController.signal.addEventListener("abort", abortHandler);

			/** Check if text matches any known "Unsend" variant */
			const isUnsendText = (text) => {
				const normalized = text.trim().toLocaleLowerCase();
				return UNSEND_TEXT_VARIANTS.some(v => normalized === v)
			};

			try {
				const unsendButton = await Promise.race([
					this.clickElementAndWaitFor(
						actionButton,
						this.root.ownerDocument.body,
						(mutations) => {
							if (mutations) {
								const addedNodes = [...mutations.map(mutation => [...mutation.addedNodes])].flat().filter(node => node.nodeType === 1);
								for (const addedNode of addedNodes) {
									const node = [...addedNode.querySelectorAll("span,div")].find(node => isUnsendText(node.textContent) && node.firstChild?.nodeType === 3);
									if (node) {
										console.debug("Workflow step 2 : found unsend node via mutation", node);
										return node
									}
								}
							}
							// Fallback: scan the whole document for an unsend menu item already present
							const allSpans = this.root.ownerDocument.querySelectorAll("[role=menu] span, [role=menu] div, [role=menuitem] span, [role=menuitem] div");
							for (const span of allSpans) {
								if (isUnsendText(span.textContent) && span.firstChild?.nodeType === 3) {
									console.debug("Workflow step 2 : found unsend node via document scan", span);
									return span
								}
							}
						},
						waitAbortController
					),
					new Promise((resolve, reject) => {
						promiseTimeout = setTimeout(() => reject("Timeout openActionsMenu"), 3000);
					})
				]);

				console.debug("Workflow step 2 : Found unsendButton", unsendButton);
				return unsendButton
			} finally {
				waitAbortController.abort(); // Aborting without reason because the reason is the error itself
				clearTimeout(promiseTimeout);
				abortController.signal.removeEventListener("abort", abortHandler);
			}
		}

		/**
		 * Closes the actions menu.
		 *
		 * @param {HTMLButtonElement} actionButton
		 * @param {HTMLDivElement} actionsMenuElement
		 * @param {AbortController} abortController
		 * @returns {Promise<boolean>}
		 */
		async closeActionsMenu(actionButton, actionsMenuElement, abortController) {
			console.debug("closeActionsMenu");
			const waitAbortController = new AbortController();
			let promiseTimeout;
			const abortHandler = () => {
				waitAbortController.abort("closeActionsMenu step was aborted by the parent process");
				clearTimeout(promiseTimeout);
			};
			abortController.signal.addEventListener("abort", abortHandler);

			try {
				const result = await Promise.race([
					this.clickElementAndWaitFor(
						actionButton,
						this.root.ownerDocument.body,
						() => this.root.ownerDocument.body.contains(actionsMenuElement) === false,
						abortController
					),
					new Promise((resolve, reject) => {
						promiseTimeout = setTimeout(() => reject("Timeout closeActionsMenu"), 500);
					})
				]);
				return result !== null
			} finally {
				waitAbortController.abort();
				clearTimeout(promiseTimeout);
				abortController.signal.removeEventListener("abort", abortHandler);
			}
		}

		/**
		 * Click unsend button and wait for the confirmation dialog.
		 *
		 * @param {HTMLSpanElement} unsendButton
		 * @param {AbortController} abortController
		 * @returns {Promise<HTMLButtonElement>|Promise<Error>}
		 */
		openConfirmUnsendModal(unsendButton, abortController) {
			console.debug("Workflow step 3 : Clicking unsendButton and waiting for dialog to appear...");
			return this.clickElementAndWaitFor(
				unsendButton,
				this.root.ownerDocument.body,
				() => this.root.ownerDocument.querySelector("[role=dialog] button"),
				abortController
			)
		}

		/**
		 * Click unsend confirm button in the modal dialog.
		 *
		 * @param {HTMLButtonElement} dialogButton
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		async confirmUnsend(dialogButton, abortController) {
			console.debug("Workflow final step : confirmUnsend", dialogButton);
			await this.clickElementAndWaitFor(
				dialogButton,
				this.root.ownerDocument.body,
				() => this.root.ownerDocument.querySelector("[role=dialog] button") === null,
				abortController
			);
		}

	}

	/** @module uipi-message API for UIMessage */


	class FailedWorkflowException extends Error {}

	class UIPIMessage {

		/**
		 * @param {UIMessage} uiMessage
		 */
		constructor(uiMessage) {
			this._uiMessage = uiMessage;
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<boolean>}
		 */
		async unsend(abortController) {
			console.debug("UIPIMessage unsend");
			let actionButton;
			let unsendButton;
			try {
				actionButton = await this.uiMessage.showActionsMenuButton(abortController);
				unsendButton = await this.uiMessage.openActionsMenu(actionButton, abortController);
				console.debug("unsendButton", unsendButton);
				const dialogButton = await this.uiMessage.openConfirmUnsendModal(unsendButton, abortController);
				await this.uiMessage.confirmUnsend(dialogButton, abortController);
				this.uiMessage.root.setAttribute("data-idmu-unsent", "");
				return true
			} catch(ex) {
				console.error(ex);
				this.uiMessage.root.setAttribute("data-idmu-ignore", "");
				// Dismiss any open overlay so the next message starts clean
				try {
					const doc = this.uiMessage.root.ownerDocument;
					doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
					await new Promise(resolve => setTimeout(resolve, 200));
					// If dialog is still open, press Escape again
					if (doc.querySelector("[role=dialog]")) {
						doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
						await new Promise(resolve => setTimeout(resolve, 200));
					}
				} catch (error) {
					console.error(error);
				}
				throw new FailedWorkflowException("Failed to execute workflow for this message", ex)
			}
		}

		/**
		 * @type {UIMessage}
		 */
		get uiMessage() {
			return this._uiMessage
		}

	}

	/**
	 *
	 * @abstract
	 */
	class UI extends UIComponent {

		/**
		 *
		 * @abstract
		 * @returns {UI}
		 */
		static create() {
		}

		/**
		 *
		 * @abstract
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		/* eslint-disable-next-line no-unused-vars */
		async fetchAndRenderThreadNextMessagePage(abortController) {
		}

		/**
		 *
		 * @abstract
		 * @returns {Promise<UIPIMessage>}
		 */
		async getNextUIPIMessage() {
		}

	}

	/** @module dom-lookup Utils module for looking up elements on the default UI */


	/**
	 * Finds the scrollable messages container inside the conversation panel.
	 * Instagram removed role="grid" — we now locate the container via aria-label
	 * and walk into its scrollable child.
	 *
	 * @param {Window} window
	 * @returns {HTMLDivElement|null}
	 */
	function findMessagesWrapper(window) {
		const conversation = window.document.querySelector("[data-pagelet='IGDMessagesList']");
		if (!conversation) {
			return null
		}
		const scrollable = findScrollableChild(conversation, window);
		if (!scrollable) {
			return null
		}
		return scrollable
	}

	/**
	 * Recursively finds the first scrollable descendant of a given element.
	 *
	 * @param {Element} parent
	 * @param {Window} window
	 * @returns {HTMLDivElement|null}
	 */
	function findScrollableChild(parent, window) {
		for (const child of parent.children) {
			const style = window.getComputedStyle(child);
			if (
				(style.overflowY === "auto" || style.overflowY === "scroll") &&
				child.scrollHeight > child.clientHeight
			) {
				return child
			}
			const found = findScrollableChild(child, window);
			if (found) {
				return found
			}
		}
		return null
	}

	/**
	 * Returns the inner container that holds individual message row divs.
	 * Traverses wrapper layers to find the div with the most children (the message list).
	 *
	 * @param {Element} scrollable
	 * @returns {HTMLDivElement}
	 */
	function getMessagesInnerContainer(scrollable) {
		// Instagram wraps messages in several nested divs.
		// Strategy: find the deepest descendant (within 3 levels) that has the most children,
		// since the actual messages container has many direct children (one per message row).
		let best = scrollable;
		let bestCount = scrollable.children.length;

		function search(el, depth) {
			if (depth > 3) return
			for (const child of el.children) {
				if (child.children.length > bestCount) {
					best = child;
					bestCount = child.children.length;
				}
				search(child, depth + 1);
			}
		}

		search(scrollable, 0);
		return best
	}

	/**
	 * Determines whether a message element was sent by the current user.
	 * Instagram aligns sent messages to the right using flexbox (justify-content: flex-end).
	 *
	 * @param {Element} element
	 * @param {Window} window
	 * @returns {boolean}
	 */
	function isSentByCurrentUser(element, window) {
		// BFS through all descendants up to depth 8.
		// Instagram places justify-content: flex-end on a nested div (depth ~5)
		// that may be on any child branch, not just the first-child path.
		const queue = [{ el: element, depth: 0 }];
		while (queue.length > 0) {
			const { el, depth } = queue.shift();
			const s = window.getComputedStyle(el);
			if (s.justifyContent === "flex-end") {
				return true
			}
			if (depth < 8) {
				for (const child of el.children) {
					queue.push({ el: child, depth: depth + 1 });
				}
			}
		}
		return false
	}

	/**
	 * Gets the first visible message sent by the current user that hasn't been processed yet.
	 *
	 * @param {Element} root - The scrollable messages wrapper
	 * @param {AbortController} abortController
	 * @param {Window} window
	 * @returns {Element|undefined}
	 */
	function getFirstVisibleMessage(root, abortController, window) {
		const innerContainer = getMessagesInnerContainer(root);
		if (!innerContainer) {
			console.debug("getFirstVisibleMessage: no inner container found");
			return
		}

		const elements = [...innerContainer.children]
			.filter(d => {
				if (d.hasAttribute("data-idmu-ignore")) return false
				if (d.hasAttribute("data-idmu-unsent")) return false
				// Must contain message content indicators
				const hasMessageContent = d.querySelector("[role=none]") || d.querySelector("[role=presentation]");
				if (!hasMessageContent) return false
				return isSentByCurrentUser(d, window)
			});

		elements.reverse();
		if(elements.length >= 1) {
			console.debug("getFirstVisibleMessage", elements.length, "candidate elements");
		} else {
			console.debug("getFirstVisibleMessage: no candidate elements found");
		}

		for (const element of elements) {
			if (abortController.signal.aborted) {
				console.debug("abortController interupted the message filtering process: stopping...");
				break
			}
			const visibilityCheck = element.checkVisibility({
				visibilityProperty: true,
				contentVisibilityAuto: true,
				opacityProperty: true,
			});
			if (visibilityCheck === false) {
				console.debug("visibilityCheck", visibilityCheck);
				continue
			}
			const rect = element.getBoundingClientRect();
			// Check if element is at least partially in viewport.
			// For tall elements (images, long text), rect.y can be negative
			// while the element is still visible. Use bottom edge instead.
			if (rect.y + rect.height < 0 || rect.height === 0) {
				console.debug("isInView failed", rect.y, rect.height);
				continue
			}
			element.setAttribute("data-idmu-ignore", "");
			console.debug("Message in view, testing workflow...", element);
			return element
		}
	}

	/**
	 * Scrolls to top to trigger loading of older messages.
	 * Handles both normal and column-reverse layouts.
	 *
	 * In column-reverse (Instagram's current layout):
	 *   scrollTop=0 is the BOTTOM (newest messages)
	 *   scrollTop=-(scrollHeight-clientHeight) is the TOP (oldest messages)
	 *
	 * @param {Element} root
	 * @param {AbortController} abortController
	 * @returns {Promise<boolean>}
	 */
	async function loadMoreMessages(root, abortController) {
		console.debug("loadMoreMessages looking for loader... ");
		const scrollAbortController = new AbortController();
		let findLoaderTimeout;
		let resolveTimeout;
		const abortHandler = () => {
			scrollAbortController.abort("abortHandler was aborted");
			clearTimeout(findLoaderTimeout);
			if (resolveTimeout) {
				resolveTimeout();
			}
		};
		abortController.signal.addEventListener("abort", abortHandler);

		// Detect column-reverse layout
		const style = root.ownerDocument.defaultView.getComputedStyle(root);
		const isReversed = style.flexDirection === "column-reverse";
		// In column-reverse, "scroll to top" means most negative scrollTop
		const scrollToTopValue = isReversed
			? -(root.scrollHeight - root.clientHeight)
			: 0;
		// In column-reverse, "at top" means scrollTop is at or near minimum
		const isAtTop = () => isReversed
			? root.scrollTop <= scrollToTopValue + 5
			: root.scrollTop === 0;

		const beforeScroll = root.scrollTop;
		const beforeHeight = root.scrollHeight;
		root.scrollTop = scrollToTopValue;

		// Helper: find a visible loader within the scrollable root's viewport
		const findVisibleLoader = () => {
			const bars = root.querySelectorAll("[role=progressbar]");
			for (const bar of bars) {
				const rect = bar.getBoundingClientRect();
				const rootRect = root.getBoundingClientRect();
				// Must be within root's horizontal+vertical bounds and have dimensions
				if (rect.height > 0 && rect.y >= rootRect.y - 100 && rect.y <= rootRect.y + rootRect.height + 100) {
					return bar
				}
			}
			return null
		};

		// Short chat: everything fits in viewport, nothing to load
		const noScrollNeeded = isReversed
			? beforeScroll === 0 && root.scrollHeight <= root.clientHeight + 50
			: beforeScroll === 0 && root.scrollHeight <= root.clientHeight + 50;
		if (noScrollNeeded) {
			console.debug("loadMoreMessages: chat fits in viewport, marking as done");
			abortController.signal.removeEventListener("abort", abortHandler);
			return true
		}

		// Already at top after scrolling: wait briefly for new content, then check
		if (isAtTop()) {
			// Give Instagram a moment to start loading older messages
			await new Promise(resolve => setTimeout(resolve, 500));

			// Check if a visible loader appeared
			const loader = findVisibleLoader();
			if (loader) {
				console.debug("loadMoreMessages: Found visible loader after scroll; waiting for removal (max 5s)");
				await Promise.race([
					waitForElement(root, () => findVisibleLoader() === null, abortController),
					new Promise(resolve => setTimeout(resolve, 5000))
				]);
				abortController.signal.removeEventListener("abort", abortHandler);
				const grew = root.scrollHeight > beforeHeight;
				console.debug(`loadMoreMessages: loader phase done, content ${grew ? "grew" : "did not grow"}`);
				return !grew
			}

			// No loader appeared — check if scrollHeight grew (new content loaded without spinner)
			const grew = root.scrollHeight > beforeHeight;
			if (!grew) {
				console.debug("loadMoreMessages: at top, no loader, no new content — reached last page");
				abortController.signal.removeEventListener("abort", abortHandler);
				return true
			}
		}

		// Fallback: wait for progressbar to appear (with shorter timeout)
		let loadingElement;
		try {
			loadingElement = await Promise.race([
				waitForElement(root, () => {
					if (findVisibleLoader() === null) {
						root.scrollTop = scrollToTopValue;
					}
					return findVisibleLoader()
				}, scrollAbortController),
				new Promise(resolve => {
					resolveTimeout = resolve;
					findLoaderTimeout = setTimeout(() => {
						resolve();
					}, 3000);
				})
			]);
		} catch (ex) {
			console.error(ex);
		}
		scrollAbortController.abort("Scrolling took too much time. Timeout after 10s");
		abortController.signal.removeEventListener("abort", abortHandler);
		clearTimeout(findLoaderTimeout);
		if (loadingElement && loadingElement !== true) {
			console.debug("loadMoreMessages: Found loader; Stand-by until it is removed (max 5s)");
			await Promise.race([
				waitForElement(root, () => findVisibleLoader() === null, abortController),
				new Promise(resolve => setTimeout(resolve, 5000))
			]);
		}
		const atTop = isAtTop();
		console.debug(`loadMoreMessages: scrollTop is ${root.scrollTop} — ${atTop ? "reached last page" : "not last page"}`);
		return atTop
	}

	/** @module ui-messages-wrapper UI element representing the messages wrapper */


	class UIMessagesWrapper extends UIComponent {

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		fetchAndRenderThreadNextMessagePage(abortController) {
			return loadMoreMessages(this.root, abortController)
		}

	}

	/** @module default-ui Default UI / English UI */


	class DefaultUI extends UI {

		constructor(root, identifier = {}) {
			super(root, identifier);
			this.lastScrollTop = null;
		}

		/**
		 * @param {Window} window
		 * @returns {DefaultUI}
		 */
		static create(window) {
			console.debug("UI create: Looking for messagesWrapperElement");
			const messagesWrapperElement = findMessagesWrapper(window);
			if (messagesWrapperElement !== null) {
				console.debug("Found messagesWrapperElement", messagesWrapperElement);
				const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement);
				return new DefaultUI(window, { uiMessagesWrapper })
			} else {
				throw new Error("Unable to find messagesWrapperElement. The query selector might be out of date.")
			}
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		async fetchAndRenderThreadNextMessagePage(abortController) {
			console.debug("UI fetchAndRenderThreadNextMessagePage");
			return await this.identifier.uiMessagesWrapper.fetchAndRenderThreadNextMessagePage(abortController)
		}

		/**
		 * Scroll until a (visible) message is found and return it.
		 *
		 * Instagram uses flex-direction: column-reverse on the messages container.
		 * This means scrollTop=0 is the BOTTOM (newest messages) and scrolling to
		 * older messages requires NEGATIVE scrollTop values.
		 * In normal (non-reversed) layouts, scrollTop=0 is the top and the max is positive.
		 *
		 * This method detects the layout direction and scrolls accordingly.
		 *
		 * @param {AbortController} abortController
		 * @returns {Promise<UIPIMessage|false>}
		 */
		async getNextUIPIMessage(abortController) {
			console.debug("UI getNextUIPIMessage", this.lastScrollTop);
			const uiMessagesWrapperRoot = this.identifier.uiMessagesWrapper.root;

			// Detect column-reverse: scrollTop can go negative
			const style = this.root.getComputedStyle
				? this.root.getComputedStyle(uiMessagesWrapperRoot)
				: uiMessagesWrapperRoot.ownerDocument.defaultView.getComputedStyle(uiMessagesWrapperRoot);
			const isReversed = style.flexDirection === "column-reverse";

			// Pre-check: try finding a message at the current scroll position without scrolling.
			// This catches messages already visible in viewport (common for short conversations
			// and after unsending when the DOM shrinks).
			try {
				const messageElement = getFirstVisibleMessage(uiMessagesWrapperRoot, abortController, this.root);
				if (messageElement) {
					console.debug("getNextUIPIMessage: found message without scrolling");
					const uiMessage = new UIMessage(messageElement);
					return new UIPIMessage(uiMessage)
				}
			} catch (ex) {
				console.error(ex);
			}

			// Allow up to 3 full passes; covers cases where DOM shrinks after unsends
			for (let pass = 0; pass < 3; pass++) {
				if (abortController.signal.aborted) {
					console.debug("abortController interupted the scrolling: stopping...");
					return false
				}

				if (isReversed) {
					// column-reverse: scrollTop ranges from 0 (bottom/newest) to negative (top/oldest)
					const minScroll = -(uiMessagesWrapperRoot.scrollHeight - uiMessagesWrapperRoot.clientHeight);
					const startPos = (pass === 0 && this.lastScrollTop !== null)
						? Math.max(this.lastScrollTop, minScroll)
						: 0; // Start from bottom (newest)

					// Use smaller increments for short conversations to avoid overshooting
					const totalRange = Math.abs(minScroll);
					const step = totalRange < 500 ? 30 : 150;

					console.debug(`getNextUIPIMessage [reversed] pass=${pass}, startPos=${startPos}, minScroll=${minScroll}, step=${step}`);

					for (let i = startPos; i >= minScroll; i = i - step) {
						if (abortController.signal.aborted) {
							console.debug("abortController interupted the scrolling: stopping...");
							return false
						}
						this.lastScrollTop = i;
						uiMessagesWrapperRoot.scrollTop = i;
						uiMessagesWrapperRoot.dispatchEvent(new this.root.Event("scroll"));
						await new Promise(resolve => setTimeout(resolve, 5));
						try {
							const messageElement = getFirstVisibleMessage(uiMessagesWrapperRoot, abortController, this.root);
							if (messageElement) {
								const uiMessage = new UIMessage(messageElement);
								return new UIPIMessage(uiMessage)
							}
						} catch (ex) {
							console.error(ex);
						}
					}
				} else {
					// Normal layout: scrollTop ranges from 0 (top) to positive max (bottom)
					const maxScroll = uiMessagesWrapperRoot.scrollHeight - uiMessagesWrapperRoot.clientHeight;
					const startScrollTop = (pass === 0 && this.lastScrollTop !== null)
						? Math.min(this.lastScrollTop, maxScroll)
						: maxScroll;

					// Use smaller increments for short conversations
					const step = maxScroll < 500 ? 30 : 150;

					console.debug(`getNextUIPIMessage pass=${pass}, startScrollTop=${startScrollTop}, maxScroll=${maxScroll}, step=${step}`);

					for (let i = Math.max(1, startScrollTop); i > 0; i = i - step) {
						if (abortController.signal.aborted) {
							console.debug("abortController interupted the scrolling: stopping...");
							return false
						}
						this.lastScrollTop = i;
						uiMessagesWrapperRoot.scrollTop = i;
						uiMessagesWrapperRoot.dispatchEvent(new this.root.Event("scroll"));
						await new Promise(resolve => setTimeout(resolve, 5));
						try {
							const messageElement = getFirstVisibleMessage(uiMessagesWrapperRoot, abortController, this.root);
							if (messageElement) {
								const uiMessage = new UIMessage(messageElement);
								return new UIPIMessage(uiMessage)
							}
						} catch (ex) {
							console.error(ex);
						}
					}
				}

				// Reached the end without finding a message.
				// Reset for a fresh pass (DOM may have shrunk after unsends).
				this.lastScrollTop = null;
				console.debug(`getNextUIPIMessage: pass ${pass} found nothing, retrying`);
			}

			console.debug("getNextUIPIMessage: exhausted all passes, no messages left");
			return false
		}

	}

	/** @module get-ui UI loader module. Allow loading of a certain UI based on a given strategy (locale etc..)
	 * There might be need for multiple UI as Instagram might serve different apps based on location for example.
	 * There is also a need to internationalize each ui so that it doesn't fail if we change the language.
	 */


	/**
	 *
	 * @returns {UI}
	 */
	function getUI() {
		return DefaultUI
	}

	/** @module uipi API for UI */


	/**
	 * UI Interface API
	 */
	class UIPI {

		/**
		 *
		 * @param {UI} ui
		 */
		constructor(ui) {
			this._ui = ui;
		}

		/**
		 *
		 * @param {Window} window
		 * @returns {UIPI}
		 */
		static create(window) {
			console.debug("UIPI.create");
			const ui = getUI().create(window);
			return new UIPI(ui)
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		fetchAndRenderThreadNextMessagePage(abortController) {
			console.debug("UIPI fetchAndRenderThreadNextMessagePage");
			return this.ui.fetchAndRenderThreadNextMessagePage(abortController)
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<UIPIMessage>}
		 */
		getNextUIPIMessage(abortController) {
			console.debug("UIPI getNextUIPIMessage");
			return this.ui.getNextUIPIMessage(abortController)
		}

		/**
		 *
		 * @type {UI}
		 */
		get ui() {
			return this._ui
		}

	}

	/** @module idmu Global/Main API for interacting with the UI */


	class IDMU {

		/**
		 *
		 * @param {Window} window
		 * @param {callback} onStatusText
		 */
		constructor(window, onStatusText) {
			this.window = window;
			this.uipi = null;
			this.onStatusText = onStatusText;
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<UIPIMessage>}
		 */
		getNextUIPIMessage(abortController) {
			return this.uipi.getNextUIPIMessage(abortController)
		}

		/**
		 *
		 * @param {string} text
		 */
		setStatusText(text) {
			this.onStatusText(text);
		}


		/**
		 *
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		fetchAndRenderThreadNextMessagePage(abortController) {
			return this.uipi.fetchAndRenderThreadNextMessagePage(abortController)
		}

		/**
		 * Map Instagram UI
		 */
		loadUIPI() {
			console.debug("loadUIPI");
			this.uipi = UIPI.create(this.window);
		}


	}

	/** @module unsend-strategy Various strategies for unsending messages */


	/**
	 *
	 * @abstract
	 */
	class UnsendStrategy {

		/**
		 *
		 * @param {IDMU} idmu
		 */
		constructor(idmu) {
			this._idmu = idmu;
		}

		/**
		 *
		 * @abstract
		 * @returns {boolean}
		 */
		isRunning() {
		}

		/**
		 *
		 * @abstract
		 */
		stop() {
		}

		/**
		 *
		 * @abstract
		 */
		reset() {
		}

		/**
		 *
		 * @abstract
		 */
		async run() {
		}

		/**
		 * @readonly
		 * @type {IDMU}
		 */
		get idmu() {
			return this._idmu
		}

	}

	/** @module unsend-strategy Various strategies for unsending messages */


	/**
	 * Loads all pages first, then unsends messages from bottom to top.
	 * For short conversations (all messages fit in viewport), skips page loading entirely.
	 */
	class DefaultStrategy extends UnsendStrategy {

		/**
		 * @param {IDMU} idmu
		 */
		constructor(idmu) {
			super(idmu);
			this._allPagesLoaded = false;
			this._unsentCount = 0;
			this._pagesLoadedCount = 0;
			this._running = false;
			this._abortController = null;
			this._lastUnsendDate = null;
			this._consecutiveFailures = 0;
		}

		/**
		 * @returns {boolean}
		 */
		isRunning() {
			return this._running && this._abortController && this._abortController.signal.aborted === false
		}

		stop() {
			console.debug("DefaultStrategy stop");
			this.idmu.setStatusText("Stopping...");
			this._abortController.abort("DefaultStrategy stopped");
		}

		reset() {
			this._allPagesLoaded = false;
			this._unsentCount = 0;
			this._lastUnsendDate = null;
			this._pagesLoadedCount = 0;
			this._consecutiveFailures = 0;
			this.idmu.setStatusText("Ready");
		}

		/**
		 * @returns {Promise}
		 */
		async run() {
			console.debug("DefaultStrategy.run()");
			this._unsentCount = 0;
			this._pagesLoadedCount = 0;
			this._consecutiveFailures = 0;
			this._running = true;
			this._abortController = new AbortController();
			// Clear stale ignore markers from previous runs so messages can be retried
			this.idmu.window.document.querySelectorAll("[data-idmu-ignore]").forEach(el => {
				el.removeAttribute("data-idmu-ignore");
			});
			this.idmu.loadUIPI();
			try {
				if (this._allPagesLoaded) {
					await this.#unsendNextMessage();
				} else {
					await this.#loadNextPage();
				}

				// Race condition: on first page load, Instagram's React may not have
				// finished hydrating message components (role attributes missing).
				// If we found nothing, wait and re-scan up to 3 times.
				if (this._unsentCount === 0 && !this._abortController.signal.aborted) {
					for (let retry = 1; retry <= 3; retry++) {
						this.idmu.setStatusText(`No messages detected, retrying (${retry}/3)...`);
						console.debug(`DefaultStrategy: 0 messages found, retry ${retry}/3`);
						await new Promise(resolve => setTimeout(resolve, 2000));
						if (this._abortController.signal.aborted) break
						// Reset for fresh scan
						this._allPagesLoaded = false;
						this._consecutiveFailures = 0;
						this.idmu.window.document.querySelectorAll("[data-idmu-ignore]").forEach(el => {
							el.removeAttribute("data-idmu-ignore");
						});
						this.idmu.loadUIPI();
						await this.#loadNextPage();
						if (this._unsentCount > 0 || this._abortController.signal.aborted) break
					}
				}

				if (this._abortController.signal.aborted) {
					this.idmu.setStatusText(`Aborted. ${this._unsentCount} message(s) unsent.`);
					console.debug("DefaultStrategy aborted");
				} else {
					this.idmu.setStatusText(`Done. ${this._unsentCount} message(s) unsent.`);
					console.debug("DefaultStrategy done");
				}
			} catch (ex) {
				console.error(ex);
				this.idmu.setStatusText(`Errored. ${this._unsentCount} message(s) unsent.`);
				console.debug("DefaultStrategy errored");
			}
			this._running = false;
		}

		/**
		 * Tries to load the thread next page.
		 * If loadMoreMessages returns true (no more pages), moves to unsending.
		 */
		async #loadNextPage() {
			if (this._abortController.signal.aborted) {
				console.debug("abortController interupted the loading of next page: stopping...");
				return
			}
			this.idmu.setStatusText("Loading next page...");
			try {
				const done = await this.idmu.fetchAndRenderThreadNextMessagePage(this._abortController);
				if (this._abortController.signal.aborted === false) {
					if (done) {
						this.idmu.setStatusText(`All pages loaded (${this._pagesLoadedCount} in total). Unsending...`);
						this._allPagesLoaded = true;
						await this.#unsendNextMessage();
					} else {
						this._pagesLoadedCount++;
						await this.#loadNextPage();
					}
				} else {
					console.debug("abortController interupted the loading of next page: stopping...");
				}
			} catch (ex) {
				console.error(ex);
			}
		}

		/**
		 * Unsend first message in viewport.
		 * Uses adaptive delays: fast baseline (1-2s) with exponential backoff on rate limit detection.
		 */
		async #unsendNextMessage() {
			if (this._abortController.signal.aborted) {
				console.debug("abortController interupted the unsending of next message: stopping...");
				return
			}
			if (this._consecutiveFailures >= 5) {
				this.idmu.setStatusText(`Stopped: ${this._consecutiveFailures} consecutive failures. ${this._unsentCount} message(s) unsent.`);
				console.debug("DefaultStrategy stopping due to consecutive failures");
				return
			}
			let canScroll = true;
			let msgElement = null;
			try {
				this.idmu.setStatusText(`Retrieving next message... (${this._unsentCount} unsent so far)`);
				const uipiMessage = await this.idmu.getNextUIPIMessage(this._abortController);
				canScroll = uipiMessage !== false;
				if (uipiMessage) {
					this.idmu.setStatusText(`Unsending message... (${this._unsentCount + 1})`);

					// Adaptive delay: 1-2s randomized baseline between unsends
					if (this._lastUnsendDate !== null) {
						const elapsed = Date.now() - this._lastUnsendDate.getTime();
						const minDelay = 1000 + Math.floor(Math.random() * 1000); // 1-2s
						if (elapsed < minDelay) {
							const waitMs = minDelay - elapsed;
							this.idmu.setStatusText(`Waiting ${(waitMs / 1000).toFixed(1)}s... (${this._unsentCount} unsent so far)`);
							await new Promise(resolve => setTimeout(resolve, waitMs));
						}
					}

					if (this._abortController.signal.aborted) return

					msgElement = uipiMessage.uiMessage.root;
					const unsent = await uipiMessage.unsend(this._abortController);

					if (unsent) {
						// Verify the message actually disappeared from DOM (server accepted the mutation)
						await new Promise(resolve => setTimeout(resolve, 800));
						const stillInDOM = msgElement.isConnected && !msgElement.hasAttribute("data-idmu-unsent");
						if (stillInDOM) {
							// Server likely rejected — the message reappeared after optimistic removal
							console.debug("DefaultStrategy: message still in DOM after unsend, possible rate limit");
							msgElement.removeAttribute("data-idmu-ignore");
							this._consecutiveFailures++;
							const backoffMs = Math.min(60000, 5000 * Math.pow(2, this._consecutiveFailures - 1));
							this.idmu.setStatusText(`Rate limit detected. Backing off ${(backoffMs / 1000).toFixed(0)}s... (${this._unsentCount} unsent)`);
							await new Promise(resolve => setTimeout(resolve, backoffMs));
						} else {
							this._lastUnsendDate = new Date();
							this._unsentCount++;
							this._consecutiveFailures = 0;
						}
					} else {
						// Unsend workflow returned false — allow retry on next pass
						console.debug("DefaultStrategy: unsend returned false, removing ignore marker for retry");
						msgElement.removeAttribute("data-idmu-ignore");
						this._consecutiveFailures++;
					}
				}
			} catch (ex) {
				console.error(ex);
				// Remove ignore marker so this message can be retried
				if (msgElement) {
					msgElement.removeAttribute("data-idmu-ignore");
				}
				this._consecutiveFailures++;
				const backoffMs = Math.min(60000, 3000 * Math.pow(2, this._consecutiveFailures - 1));
				this.idmu.setStatusText(`Workflow failed (${this._consecutiveFailures}/5), retrying in ${(backoffMs / 1000).toFixed(0)}s... (${this._unsentCount} unsent)`);
				await new Promise(resolve => setTimeout(resolve, backoffMs));
			} finally {
				if (canScroll && this._abortController && !this._abortController.signal.aborted) {
					await this.#unsendNextMessage();
				}
			}
		}

	}

	/** @module alert Alert UI */

	/**
	 *
	 * @param {Document} document
	 * @returns {HTMLButtonElement}
	 */
	function createAlertsWrapperElement(document) {
		const alertsWrapperElement = document.createElement("div");
		alertsWrapperElement.id = "idmu-alerts";
		alertsWrapperElement.style.position = "fixed";
		alertsWrapperElement.style.top = "20px";
		alertsWrapperElement.style.right = "20px";
		alertsWrapperElement.style.display = "grid";
		return alertsWrapperElement
	}

	/** @module overlay IDMU's overlay */

	/**
	 * @param {Document} document
	 * @returns {HTMLDivElement}
	 */
	function createOverlayElement(document) {
		const overlayElement = document.createElement("div");
		overlayElement.id = "idmu-overlay";
		overlayElement.tabIndex = 0;
		overlayElement.style.top = "0";
		overlayElement.style.right = "0";
		overlayElement.style.position = "fixed";
		overlayElement.style.width = "100vw";
		overlayElement.style.height = "100vh";
		overlayElement.style.zIndex = "998";
		overlayElement.style.backgroundColor = "#000000d6";
		overlayElement.style.display = "none";
		return overlayElement
	}

	/** @module ui IDMU's own ui/overlay
	 * Provide a button to unsend messages
	 */


	class OSD {
		/**
		 *
		 * @param {Document} document
		 * @param {HTMLDivElement} root
		 * @param {HTMLDivElement} overlayElement
		 * @param {HTMLDivElement} menuElement
		 * @param {HTMLButtonElement} unsendThreadMessagesButton
		 * @param {HTMLDivElement} statusElement
		 */
		constructor(document, root, overlayElement, menuElement, unsendThreadMessagesButton, statusElement) {
			this._document = document;
			this._root = root;
			this._overlayElement = overlayElement;
			this._menuElement = menuElement;
			this._statusElement = statusElement;
			this._unsendThreadMessagesButton = unsendThreadMessagesButton;
			this._idmu = new IDMU(this.window, this.onStatusText.bind(this));
			this._strategy = new DefaultStrategy(this._idmu); // TODO move out
			this._stopRequested = false;
		}

		/**
		 *
		 * @param {window} window
		 * @returns {OSD}
		 */
		static render(window) {
			console.debug("render");
			const ui = OSD.create(window.document);
			window.document.body.appendChild(ui.root);
			return ui
		}

		/**
		 *
		 * @param   {Document} document
		 * @returns {OSD}
		 */
		static create(document) {
			const root = document.createElement("div");
			root.id = "idmu-root";
			const menuElement = createMenuElement(document);
			const overlayElement = createOverlayElement(document);
			const alertsWrapperElement = createAlertsWrapperElement(document);
			const unsendThreadMessagesButton = createMenuButtonElement(document, "Unsend all DMs", BUTTON_STYLE.PRIMARY);
			const statusElement = document.createElement("div");
			statusElement.textContent = "Ready";
			statusElement.id = "idmu-status";
			statusElement.style = "width: 200px";
			document.body.appendChild(overlayElement);
			document.body.appendChild(alertsWrapperElement);
			menuElement.appendChild(unsendThreadMessagesButton);
			menuElement.appendChild(statusElement);
			root.appendChild(menuElement);
			const ui = new OSD(document, root, overlayElement, menuElement, unsendThreadMessagesButton, statusElement);
			document.addEventListener("keydown", (event) => ui.#onWindowKeyEvent(event)); // TODO test
			document.addEventListener("keyup", (event) => ui.#onWindowKeyEvent(event)); // TODO test
			unsendThreadMessagesButton.addEventListener("click", (event) => ui.#onUnsendThreadMessagesButtonClick(event));
			ui._mutationObserver = new MutationObserver((mutations) => ui.#onMutations(ui, mutations));
			ui._mutationObserver.observe(document.body, { childList: true }); // TODO test
			unsendThreadMessagesButton.dataTextContent = unsendThreadMessagesButton.textContent;
			unsendThreadMessagesButton.dataBackgroundColor = unsendThreadMessagesButton.style.backgroundColor;
			return ui
		}

		/**
		 *
		 * @param {string} text
		 */
		onStatusText(text) {
			this.statusElement.textContent = text;
		}

		async #startUnsending() {
			this._stopRequested = false
			;[...this.menuElement.querySelectorAll("button")].filter(button => button !== this.unsendThreadMessagesButton).forEach(button => {
				button.style.visibility = "hidden";
				button.disabled = true;
			});
			this.overlayElement.style.display = "";
			this.overlayElement.focus();
			this.unsendThreadMessagesButton.textContent = "Stop processing";
			this.unsendThreadMessagesButton.style.backgroundColor = "#FA383E";
			this.statusElement.style.color = "white";
			this._mutationObserver.disconnect();
			try {
				await this.strategy.run();
			} catch(error) {
				if(this._stopRequested || this.strategy._abortController?.signal.aborted) {
					return
				}
				console.error(error);
				if(this.strategy.isRunning()) {
					this.strategy.stop();
				}
				this.statusElement.innerHTML = `<span style="color: red">An error occured, <a href="https://github.com/thoughtsunificator/instagram-dm-unsender/issues/new?template=bug_report.md">please open an issue</a></span>`;
			} finally {
				this.#onUnsendingFinished();
			}
		}

		/**
		 *
		 * @param {OSD} ui
		 */
		#onMutations(ui) {
			if(ui.root.ownerDocument.querySelector("[id^=mount] > div > div > div") !== null && ui) {
				if(this._mutationObserver) {
					this._mutationObserver.disconnect();
				}
				this._mutationObserver = new MutationObserver(ui.#onMutations.bind(this, ui));
				this._mutationObserver.observe(ui.root.ownerDocument.querySelector("[id^=mount] > div > div > div"), { childList: true, attributes: true });
			}
			if(this.window.location.pathname.startsWith("/direct/t/")) {
				if(!this.strategy.isRunning()) {
					this.strategy.reset();
				}
				this.root.style.display = "";
			} else {
				this.root.style.display = "none";
				if(this.strategy.isRunning()) {
					this.strategy.stop();
				}
			}
		}

		/**
		 *
		 * @param {OSD} ui
		 * @param {Event} event
		 */
		#onUnsendThreadMessagesButtonClick() {
			if(this.strategy.isRunning()) {
				console.debug("User asked for messages unsending to stop");
				this._stopRequested = true;
				this.strategy.stop();
				this.#onUnsendingFinished();
			} else {
				console.debug("User asked for messages unsending to start; UI interaction will be disabled in the meantime");
				this.#startUnsending();
			}
		}

		/**
		 *
		 * @param {Event} event
		 * @returns {boolean}
		 */
		#onWindowKeyEvent(event) {
			if(this.strategy.isRunning()) {
				console.log("User interaction is disabled as the unsending is still running; Please stop the execution first.");
				event.stopImmediatePropagation();
				event.preventDefault();
				event.stopPropagation();
				this.overlayElement.focus();
				return false
			}
		}

		#onUnsendingFinished() {
			console.debug("render onUnsendingFinished")
			;[...this.menuElement.querySelectorAll("button")].filter(button => button !== this.unsendThreadMessagesButton).forEach(button => {
				button.style.visibility = "";
				button.disabled = false;
			});
			this.unsendThreadMessagesButton.textContent = this.unsendThreadMessagesButton.dataTextContent;
			this.unsendThreadMessagesButton.style.backgroundColor = this.unsendThreadMessagesButton.dataBackgroundColor;
			this.overlayElement.style.display = "none";
			this.statusElement.style.color = "";
			this._mutationObserver.observe(this._document.body, { childList: true }); // TODO test
		}

		/**
		 * @readonly
		 * @type {Document}
		 */
		get document() {
			return this._document
		}

		/**
		 * @readonly
		 * @type {Window}
		 */
		get window() {
			return this._document.defaultView
		}

		/**
		 * @readonly
		 * @type {HTMLDivElement}
		 */
		get root() {
			return this._root
		}

		/**
		 * @readonly
		 * @type {HTMLDivElement}
		 */
		get overlayElement() {
			return this._overlayElement
		}

		/**
		 * @readonly
		 * @type {HTMLDivElement}
		 */
		get menuElement() {
			return this._menuElement
		}

		/**
		 * @readonly
		 * @type {HTMLButtonElement}
		 */
		get unsendThreadMessagesButton() {
			return this._unsendThreadMessagesButton
		}

		/**
		 * @readonly
		 * @type {HTMLDivElement}
		 */
		get statusElement() {
			return this._statusElement
		}

		/**
		 * @readonly
		 * @type {UnsendStrategy}
		 */
		get strategy() { // TODO move out
			return this._strategy
		}

		/**
		 * @readonly
		 * @type {IDMU}
		 */
		get idmu() {
			return this._idmu
		}

	}

	/** @module main Main module */


	/**
	 * @param {Window} window
	 */
	function main(window) {
		OSD.render(window);
	}

	if(typeof window !== "undefined") {
		main(window);
	}

	exports.main = main;

	return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L29zZC9zdHlsZS9pbnN0YWdyYW0uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L29zZC9tZW51LWJ1dHRvbi5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvb3NkL21lbnUuanMiLCIuLi9zcmMvZG9tL2FzeW5jLWV2ZW50cy5qcyIsIi4uL3NyYy91aS91aS1jb21wb25lbnQuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC9zdHJpbmdzLmpzIiwiLi4vc3JjL3VpL2RlZmF1bHQvdWktbWVzc2FnZS5qcyIsIi4uL3NyYy91aXBpL3VpcGktbWVzc2FnZS5qcyIsIi4uL3NyYy91aS91aS5qcyIsIi4uL3NyYy91aS9kZWZhdWx0L2RvbS1sb29rdXAuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC91aS1tZXNzYWdlcy13cmFwcGVyLmpzIiwiLi4vc3JjL3VpL2RlZmF1bHQvZGVmYXVsdC11aS5qcyIsIi4uL3NyYy91aS9nZXQtdWkuanMiLCIuLi9zcmMvdWlwaS91aXBpLmpzIiwiLi4vc3JjL2lkbXUvaWRtdS5qcyIsIi4uL3NyYy91aS91bnNlbmQtc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC91bnNlbmQtc3RyYXRlZ3kuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L29zZC9hbGVydC5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvb3NkL292ZXJsYXkuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L29zZC9vc2QuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L21haW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqIEBtb2R1bGUgaW5zdGFncmFtIEhlbHBlcnMgdG8gbWltaWNrIEluc3RhZ3JhbSdzIGxvb2sgYW5kIGZlZWwgKi9cblxuZXhwb3J0IGNvbnN0IEJVVFRPTl9TVFlMRSA9IHtcblx0XCJQUklNQVJZXCI6IFwicHJpbWFyeVwiLFxuXHRcIlNFQ09OREFSWVwiOiBcInNlY29uZGFyeVwiLFxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBidXR0b25FbGVtZW50XG4gKiBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICBzdHlsZU5hbWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5QnV0dG9uU3R5bGUoYnV0dG9uRWxlbWVudCwgc3R5bGVOYW1lKSB7XG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZm9udFNpemUgPSBcInZhcigtLXN5c3RlbS0xNC1mb250LXNpemUpXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5jb2xvciA9IFwid2hpdGVcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJvcmRlciA9IFwiMHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5ib3JkZXJSYWRpdXMgPSBcIjhweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUucGFkZGluZyA9IFwiOHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5mb250V2VpZ2h0ID0gXCJib2xkXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5jdXJzb3IgPSBcInBvaW50ZXJcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmxpbmVIZWlnaHQgPSBcInZhcigtLXN5c3RlbS0xNC1saW5lLWhlaWdodClcIlxuXHRpZihzdHlsZU5hbWUpIHtcblx0XHRidXR0b25FbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGByZ2IodmFyKC0taWctJHtzdHlsZU5hbWV9LWJ1dHRvbikpYFxuXHR9XG59XG4iLCIvKiogQG1vZHVsZSBtZW51LWJ1dHRvbiBIZWxwZXJzIHRvIGNyZWF0ZSBidXR0b25zIHRoYXQgY2FuIGJlIHVzZWQgaW4gSURNVSdzIG1lbnUgKi9cblxuaW1wb3J0IHsgYXBwbHlCdXR0b25TdHlsZSB9IGZyb20gXCIuL3N0eWxlL2luc3RhZ3JhbS5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcGFyYW0ge3N0cmluZ30gICB0ZXh0XG4gKiBAcGFyYW0ge3N0cmluZ30gICBzdHlsZU5hbWVcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50KGRvY3VtZW50LCB0ZXh0LCBzdHlsZU5hbWUpIHtcblx0Y29uc3QgYnV0dG9uRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIilcblx0YnV0dG9uRWxlbWVudC50ZXh0Q29udGVudCA9IHRleHRcblx0YXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWUpXG5cdGJ1dHRvbkVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCAoKSA9PiB7XG5cdFx0YnV0dG9uRWxlbWVudC5zdHlsZS5maWx0ZXIgPSBgYnJpZ2h0bmVzcygxLjE1KWBcblx0fSlcblx0YnV0dG9uRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIiwgKCkgPT4ge1xuXHRcdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZmlsdGVyID0gYGBcblx0fSlcblx0cmV0dXJuIGJ1dHRvbkVsZW1lbnRcbn1cbiIsIi8qKiBAbW9kdWxlIG1lbnUgSURNVSdzIG1haW4gbWVudSAqL1xuXG4vKipcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNZW51RWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBtZW51RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0bWVudUVsZW1lbnQuaWQgPSBcImlkbXUtbWVudVwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnRvcCA9IFwiMjBweFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCI0MzBweFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnpJbmRleCA9IDk5OVxuXHRtZW51RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJmbGV4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUuZ2FwID0gXCIxMHB4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUucGxhY2VJdGVtcyA9IFwiY2VudGVyXCJcblx0cmV0dXJuIG1lbnVFbGVtZW50XG59XG4iLCIvKiogQG1vZHVsZSBhc3luYy1ldmVudHMgVXRpbHMgbW9kdWxlIGZvciBmaW5kaW5nIGVsZW1lbnRzIGFzeW5jaHJvbm91c2x5IGluIHRoZSBET00gKi9cblxuLyoqXG4gKlxuICogQGNhbGxiYWNrIGdldEVsZW1lbnRcbiAqIEByZXR1cm5zIHtFbGVtZW50fVxuICovXG5cbi8qKlxuICogUnVuIGEgY2FsbGJhY2sgb24gRE9NIG11dGF0aW9uIChhZGRlZE5vZGUpIHRoYXQgdGVzdHMgd2hldGhlciBhIHNwZWNpZmljIGVsZW1lbnQgd2FzIGZvdW5kIChvciB3YXMgbm90IGZvdW5kKVxuICogV2hlbiB0aGUgY2FsbGJhY2sgcmV0dXJucyB0cnVlIHRoZSBwcm9taXNlIGlzIHJlc29sdmVkXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICogQHBhcmFtIHtnZXRFbGVtZW50fSBnZXRFbGVtZW50XG4gKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cbiAqIEBleGFtcGxlXG4gKiB3YWl0Rm9yRWxlbWVudChcbiAqXHRcdGJvZHksXG4gKlx0XHQoKSA9PiBib2R5LmNvbnRhaW5zKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJidXR0b24jZm9vXCIpKSxcbiAqXHRcdGFib3J0Q29udHJvbGxlclxuICpcdClcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0bGV0IG11dGF0aW9uT2JzZXJ2ZXJcblx0XHRjb25zdCBhYm9ydEhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHRpZihtdXRhdGlvbk9ic2VydmVyKSB7XG5cdFx0XHRcdG11dGF0aW9uT2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHR9XG5cdFx0XHRyZWplY3QobmV3IEVycm9yKGB3YWl0Rm9yRWxlbWVudCBhYm9ydGVkOiAke2Fib3J0Q29udHJvbGxlci5zaWduYWwucmVhc29ufWApKVxuXHRcdH1cblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0bGV0IGVsZW1lbnQgPSBnZXRFbGVtZW50KClcblx0XHRpZihlbGVtZW50KSB7XG5cdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0fSBlbHNlIHtcblx0XHRcdG11dGF0aW9uT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zLCBvYnNlcnZlcikgPT4ge1xuXHRcdFx0XHRlbGVtZW50ID0gZ2V0RWxlbWVudChtdXRhdGlvbnMpXG5cdFx0XHRcdGlmKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRvYnNlcnZlci5kaXNjb25uZWN0KClcblx0XHRcdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0XHRcdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdFx0bXV0YXRpb25PYnNlcnZlci5vYnNlcnZlKHRhcmdldCwgeyBzdWJ0cmVlOiB0cnVlLCBjaGlsZExpc3Q6IHRydWUgfSlcblx0XHR9XG5cdH0pXG59XG5cbi8qKlxuICogQ2xpY2sgdGFyZ2V0IGFuZCBydW4gd2FpdEZvckVsZW1lbnRcbiAqIEBwYXJhbSB7RWxlbWVudH0gY2xpY2tUYXJnZXRcbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gKiBAcGFyYW0ge2dldEVsZW1lbnR9IGdldEVsZW1lbnRcbiAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcbiAqIEByZXR1cm5zIHtFbGVtZW50fFByb21pc2U8RWxlbWVudD59XG4gKiBAZXhhbXBsZVxuICogSW4gdGhpcyBjYXNlIGNsaWNraW5nIFwiI2Zvb1wiIGJ1dHRvbiB3b3VsZCBtYWtlIFwiI2JhclwiIGFwcGVhclxuICogY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcbiAqXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjZm9vXCIpLFxuICpcdFx0Ym9keSxcbiAqXHRcdCgpID0+IGJvZHkuY29udGFpbnMoZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNiYXJcIikpLFxuICpcdFx0YWJvcnRDb250cm9sbGVyXG4gKlx0KVxuICovXG5leHBvcnQgZnVuY3Rpb24gY2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50LCBhYm9ydENvbnRyb2xsZXIpIHtcblx0Y29uc3QgcHJvbWlzZSA9IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKVxuXHRjbGlja1RhcmdldC5jbGljaygpXG5cdHJldHVybiBnZXRFbGVtZW50KCkgfHwgcHJvbWlzZVxufVxuIiwiLyoqIEBtb2R1bGUgdWktY29tcG9uZW50IEJhc2UgY2xhc3MgZm9yIGFueSBlbGVtZW50IHRoYXQgaXMgYSBwYXJ0IG9mIHRoZSBVSS4gKi9cblxuaW1wb3J0IHsgd2FpdEZvckVsZW1lbnQsIGNsaWNrRWxlbWVudEFuZFdhaXRGb3IgfSBmcm9tIFwiLi4vZG9tL2FzeW5jLWV2ZW50cy5qc1wiXG5cbi8qKlxuICpcbiAqIEBhYnN0cmFjdFxuICovXG5jbGFzcyBVSUNvbXBvbmVudCB7XG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3Rcblx0ICogQHBhcmFtIHtvYmplY3R9IGlkZW50aWZpZXJcblx0ICovXG5cdGNvbnN0cnVjdG9yKHJvb3QsIGlkZW50aWZpZXI9e30pIHtcblx0XHR0aGlzLnJvb3QgPSByb290XG5cdFx0dGhpcy5pZGVudGlmaWVyID0gaWRlbnRpZmllclxuXHR9XG5cblx0LyoqXG5cdCAqIEFsaWFzIG9mIGRvbS9hc3luYy1ldmVudHMjd2FpdEZvckVsZW1lbnRcblx0ICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnQ+fVxuXHQgKi9cblx0d2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50LCBhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cblx0LyoqXG5cdCAqIEFsaWFzIG9mIGRvbS9hc3luYy1ldmVudHMjY2xpY2tFbGVtZW50QW5kV2FpdEZvclxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGNsaWNrVGFyZ2V0XG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGdldEVsZW1lbnRcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cblx0ICovXG5cdGNsaWNrRWxlbWVudEFuZFdhaXRGb3IoY2xpY2tUYXJnZXQsIHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0cmV0dXJuIGNsaWNrRWxlbWVudEFuZFdhaXRGb3IoY2xpY2tUYXJnZXQsIHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlDb21wb25lbnRcbiIsImV4cG9ydCB7XG5cdFVOU0VORF9URVhUX1ZBUklBTlRTLFxuXHRMQUJFTF9QQVRURVJOU1xufVxuXG4vKiogTG9jYWxlLWluZGVwZW5kZW50IHBhdHRlcm5zIGZvciB0aGUgXCJVbnNlbmRcIiBtZW51IGl0ZW0gKi9cbmNvbnN0IFVOU0VORF9URVhUX1ZBUklBTlRTID0gW1xuXHRcInVuc2VuZFwiLCAgICAgICAgLy8gRW5nbGlzaFxuXHRcImFubnVsbGEgaW52aW9cIiwgLy8gSXRhbGlhblxuXHRcInJldGlyYXJcIiwgICAgICAgLy8gUG9ydHVndWVzZVxuXHRcImRlc2hhY2VyXCIsICAgICAgLy8gU3BhbmlzaFxuXHRcInJldGlyZXJcIiwgICAgICAgLy8gRnJlbmNoXG5cdFwienVyw7xja25laG1lblwiLCAgLy8gR2VybWFuXG5dXG5cblxuLyoqIFJlcHJlc2VudHMgdGhlIGRlc2NyaXB0aW9uIHRleHQgdGhhdCBpcyBhc3NvY2lhdGVkIHdpdGggdGhlIFwiLi4uXCIgYnV0dG9uIHRoYXQgcmV2ZWFscyB0aGUgYWN0aW9ucyBtZW51ICovXG5jb25zdCBMQUJFTF9QQVRURVJOUyA9IFtcblx0XCJbYXJpYS1sYWJlbF49J1NlZSBtb3JlIG9wdGlvbnMgZm9yIG1lc3NhZ2UnXVwiLFxuXHRcIlthcmlhLWxhYmVsKj0nbW9yZSBvcHRpb25zJ11cIixcblx0XCJbYXJpYS1sYWJlbCo9J01vcmUnXVwiLFxuXHRcIlthcmlhLWxhYmVsKj0nQWx0cmUgb3B6aW9uaSddXCIsXG5cdFwiW2FyaWEtbGFiZWwqPSdvcHppb25pJ11cIixcblx0XCJbYXJpYS1sYWJlbCo9J29wY2lvbmVzJ11cIixcblx0XCJbYXJpYS1sYWJlbCo9J29wdGlvbnMnXVwiLFxuXVxuXG4iLCIvKiogQG1vZHVsZSB1aS1tZXNzYWdlIFVJIGVsZW1lbnQgcmVwcmVzZW50aW5nIGEgbWVzc2FnZSAqL1xuXG5pbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4uL3VpLWNvbXBvbmVudC5qc1wiXG5cbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSBcIi4vc3RyaW5ncy5qc1wiXG5cbi8qKlxuICogRGlzcGF0Y2hlcyBwb2ludGVyIGFuZCBtb3VzZSBob3ZlciBldmVudHMgb24gYSB0YXJnZXQgZWxlbWVudC5cbiAqIEluc3RhZ3JhbSdzIFJlYWN0IHVzZXMgcG9pbnRlciBldmVudHMgaW50ZXJuYWxseTsgbW91c2UgZXZlbnRzIGFsb25lIGFyZSBpbnN1ZmZpY2llbnQuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqL1xuZnVuY3Rpb24gZGlzcGF0Y2hIb3ZlckluKHRhcmdldCkge1xuXHRjb25zdCByZWN0ID0gdGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG5cdGNvbnN0IG9wdHMgPSB7XG5cdFx0YnViYmxlczogdHJ1ZSxcblx0XHRjYW5jZWxhYmxlOiB0cnVlLFxuXHRcdGNsaWVudFg6IHJlY3QueCArIHJlY3Qud2lkdGggLyAyLFxuXHRcdGNsaWVudFk6IHJlY3QueSArIHJlY3QuaGVpZ2h0IC8gMixcblx0XHRwb2ludGVySWQ6IDEsXG5cdFx0cG9pbnRlclR5cGU6IFwibW91c2VcIixcblx0fVxuXHR0YXJnZXQuZGlzcGF0Y2hFdmVudChuZXcgUG9pbnRlckV2ZW50KFwicG9pbnRlcmVudGVyXCIsIHsgLi4ub3B0cywgYnViYmxlczogZmFsc2UgfSkpXG5cdHRhcmdldC5kaXNwYXRjaEV2ZW50KG5ldyBQb2ludGVyRXZlbnQoXCJwb2ludGVyb3ZlclwiLCBvcHRzKSlcblx0dGFyZ2V0LmRpc3BhdGNoRXZlbnQobmV3IFBvaW50ZXJFdmVudChcInBvaW50ZXJtb3ZlXCIsIG9wdHMpKVxuXHR0YXJnZXQuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlZW50ZXJcIiwgeyAuLi5vcHRzLCBidWJibGVzOiBmYWxzZSB9KSlcblx0dGFyZ2V0LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW92ZXJcIiwgb3B0cykpXG5cdHRhcmdldC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2Vtb3ZlXCIsIG9wdHMpKVxufVxuXG4vKipcbiAqIERpc3BhdGNoZXMgcG9pbnRlciBhbmQgbW91c2UgbGVhdmUgZXZlbnRzIG9uIGEgdGFyZ2V0IGVsZW1lbnQuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqL1xuZnVuY3Rpb24gZGlzcGF0Y2hIb3Zlck91dCh0YXJnZXQpIHtcblx0Y29uc3QgcmVjdCA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuXHRjb25zdCBvcHRzID0ge1xuXHRcdGJ1YmJsZXM6IHRydWUsXG5cdFx0Y2FuY2VsYWJsZTogdHJ1ZSxcblx0XHRjbGllbnRYOiByZWN0LnggKyByZWN0LndpZHRoIC8gMixcblx0XHRjbGllbnRZOiByZWN0LnkgKyByZWN0LmhlaWdodCAvIDIsXG5cdFx0cG9pbnRlcklkOiAxLFxuXHRcdHBvaW50ZXJUeXBlOiBcIm1vdXNlXCIsXG5cdH1cblx0dGFyZ2V0LmRpc3BhdGNoRXZlbnQobmV3IFBvaW50ZXJFdmVudChcInBvaW50ZXJvdXRcIiwgb3B0cykpXG5cdHRhcmdldC5kaXNwYXRjaEV2ZW50KG5ldyBQb2ludGVyRXZlbnQoXCJwb2ludGVybGVhdmVcIiwgeyAuLi5vcHRzLCBidWJibGVzOiBmYWxzZSB9KSlcblx0dGFyZ2V0LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW91dFwiLCBvcHRzKSlcblx0dGFyZ2V0LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZWxlYXZlXCIsIHsgLi4ub3B0cywgYnViYmxlczogZmFsc2UgfSkpXG59XG5cbmNsYXNzIFVJTWVzc2FnZSBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICogRGlzbWlzcyBhbnkgc3RhbGUgZGlhbG9nIG9yIGRyb3Bkb3duIGxlZnQgZnJvbSBhIHByZXZpb3VzIGZhaWxlZCB3b3JrZmxvdy5cblx0ICovXG5cdF9kaXNtaXNzU3RhbGVPdmVybGF5cygpIHtcblx0XHRjb25zdCBkb2MgPSB0aGlzLnJvb3Qub3duZXJEb2N1bWVudFxuXHRcdC8vIENsb3NlIHN0YWxlIGNvbmZpcm1hdGlvbiBkaWFsb2dzXG5cdFx0Y29uc3Qgc3RhbGVEaWFsb2cgPSBkb2MucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ11cIilcblx0XHRpZiAoc3RhbGVEaWFsb2cpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJEaXNtaXNzaW5nIHN0YWxlIGRpYWxvZ1wiKVxuXHRcdFx0Y29uc3QgY2xvc2VCdG4gPSBzdGFsZURpYWxvZy5xdWVyeVNlbGVjdG9yKFwiYnV0dG9uXCIpXG5cdFx0XHRpZiAoY2xvc2VCdG4pIGNsb3NlQnRuLmNsaWNrKClcblx0XHR9XG5cdFx0Ly8gQ2xvc2Ugc3RhbGUgZHJvcGRvd24gbWVudXMgYnkgcHJlc3NpbmcgRXNjYXBlXG5cdFx0Y29uc3QgYWN0aXZlTWVudSA9IGRvYy5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9bWVudV0sIFtyb2xlPWxpc3Rib3hdXCIpXG5cdFx0aWYgKGFjdGl2ZU1lbnUpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJEaXNtaXNzaW5nIHN0YWxlIG1lbnUgdmlhIEVzY2FwZVwiKVxuXHRcdFx0ZG9jLmJvZHkuZGlzcGF0Y2hFdmVudChuZXcgS2V5Ym9hcmRFdmVudChcImtleWRvd25cIiwgeyBrZXk6IFwiRXNjYXBlXCIsIGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEZpbmQgdGhlIGFjdGlvbiBidXR0b24gd2l0aGluIHRoZSBtZXNzYWdlIHJvdy5cblx0ICogSW5zdGFncmFtIG1vdmVkIGFyaWEtbGFiZWwgZnJvbSB0aGUgYnV0dG9uIGRpdiB0byBhIG5lc3RlZCBTVkcvdGl0bGUuXG5cdCAqIEFueSBtYXRjaCAoU1ZHIG9yIGRpdikgaXMgd2Fsa2VkIHVwIHRvIHRoZSBuZWFyZXN0IFtyb2xlPWJ1dHRvbl0gYW5jZXN0b3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gc2NvcGVcblx0ICogQHJldHVybnMge0VsZW1lbnR8bnVsbH1cblx0ICovXG5cdF9maW5kQWN0aW9uQnV0dG9uKHNjb3BlKSB7XG5cdFx0Zm9yIChjb25zdCBzZWwgb2Ygc3RyaW5ncy5MQUJFTF9QQVRURVJOUykge1xuXHRcdFx0Y29uc3QgZWwgPSBzY29wZS5xdWVyeVNlbGVjdG9yKHNlbClcblx0XHRcdGlmIChlbCkge1xuXHRcdFx0XHQvLyBBbHdheXMgcmVzb2x2ZSB0byBhIGNsaWNrYWJsZSBidXR0b24gY29udGFpbmVyXG5cdFx0XHRcdGNvbnN0IGJ0biA9IGVsLmNsb3Nlc3QoXCJbcm9sZT1idXR0b25dXCIpIHx8IGVsLmNsb3Nlc3QoXCJidXR0b25cIilcblx0XHRcdFx0aWYgKGJ0biAmJiBzY29wZS5jb250YWlucyhidG4pKSByZXR1cm4gYnRuXG5cdFx0XHRcdC8vIGVsIGl0c2VsZiBpcyBhbHJlYWR5IGEgYnV0dG9uLWxpa2UgZWxlbWVudFxuXHRcdFx0XHRpZiAoZWwudGFnTmFtZSA9PT0gXCJCVVRUT05cIiB8fCBlbC5nZXRBdHRyaWJ1dGUoXCJyb2xlXCIpID09PSBcImJ1dHRvblwiKSByZXR1cm4gZWxcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBGYWxsYmFjazogYW55IHJvbGU9YnV0dG9uIHdpdGggYXJpYS1oYXNwb3B1cD1tZW51IGluc2lkZSB0aGUgbWVzc2FnZSByb3dcblx0XHRyZXR1cm4gc2NvcGUucXVlcnlTZWxlY3RvcihcIltyb2xlPWJ1dHRvbl1bYXJpYS1oYXNwb3B1cD1tZW51XVwiKVxuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fVxuXHQgKi9cblx0YXN5bmMgc2hvd0FjdGlvbnNNZW51QnV0dG9uKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDEgOiBzaG93QWN0aW9uc01lbnVCdXR0b25cIiwgdGhpcy5yb290KVxuXHRcdHRoaXMuX2Rpc21pc3NTdGFsZU92ZXJsYXlzKClcblxuXHRcdC8vIENvbGxlY3QgYWxsIGhvdmVyYWJsZSBhbmNlc3RvcnMgZnJvbSByb290IGRvd24gdG8gdGhlIG1lc3NhZ2UgYnViYmxlLlxuXHRcdC8vIEluc3RhZ3JhbSBSZWFjdCBsaXN0ZW5zIGF0IGludGVybWVkaWF0ZSBsZXZlbHMgKHJvbGU9Z3JvdXAsIGZsZXgtZW5kIHdyYXBwZXIpLlxuXHRcdGNvbnN0IGhvdmVyVGFyZ2V0cyA9IFt0aGlzLnJvb3RdXG5cdFx0Y29uc3QgY29sbGVjdFRhcmdldHMgPSAoZWwsIGRlcHRoKSA9PiB7XG5cdFx0XHRpZiAoZGVwdGggPiA4KSByZXR1cm5cblx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgZWwuY2hpbGRyZW4pIHtcblx0XHRcdFx0aG92ZXJUYXJnZXRzLnB1c2goY2hpbGQpXG5cdFx0XHRcdGNvbGxlY3RUYXJnZXRzKGNoaWxkLCBkZXB0aCArIDEpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbGxlY3RUYXJnZXRzKHRoaXMucm9vdCwgMClcblxuXHRcdC8vIFRyeSB1cCB0byAzIHRpbWVzIOKAlCBob3ZlciBldmVudHMgY2FuIGJlIGZsYWt5XG5cdFx0Zm9yIChsZXQgYXR0ZW1wdCA9IDA7IGF0dGVtcHQgPCAzOyBhdHRlbXB0KyspIHtcblx0XHRcdGlmIChhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHJldHVybiBudWxsXG5cblx0XHRcdGZvciAoY29uc3QgdGFyZ2V0IG9mIGhvdmVyVGFyZ2V0cykge1xuXHRcdFx0XHRkaXNwYXRjaEhvdmVySW4odGFyZ2V0KVxuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwKSlcblxuXHRcdFx0Y29uc3QgYnRuID0gdGhpcy5fZmluZEFjdGlvbkJ1dHRvbih0aGlzLnJvb3QpXG5cdFx0XHRpZiAoYnRuKSB7XG5cdFx0XHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDEgOiBmb3VuZCBhY3Rpb24gYnV0dG9uIG9uIGF0dGVtcHRcIiwgYXR0ZW1wdCwgYnRuKVxuXHRcdFx0XHRyZXR1cm4gYnRuXG5cdFx0XHR9XG5cblx0XHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDEgOiBhdHRlbXB0XCIsIGF0dGVtcHQsIFwibm8gYnV0dG9uIGZvdW5kLCByZXRyeWluZy4uLlwiKVxuXHRcdFx0ZGlzcGF0Y2hIb3Zlck91dCh0aGlzLnJvb3QpXG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgNTApKVxuXHRcdH1cblxuXHRcdC8vIEZpbmFsIGZhbGxiYWNrOiB1c2Ugd2FpdEZvckVsZW1lbnQgd2l0aCBleHRlbmRlZCB0aW1lb3V0XG5cdFx0Y29uc3Qgd2FpdEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXHRcdGxldCBwcm9taXNlVGltZW91dFxuXHRcdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoXCJzaG93QWN0aW9uc01lbnVCdXR0b24gc3RlcCB3YXMgYWJvcnRlZCBieSB0aGUgcGFyZW50IHByb2Nlc3NcIilcblx0XHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHR9XG5cdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXG5cdFx0Zm9yIChjb25zdCB0YXJnZXQgb2YgaG92ZXJUYXJnZXRzKSB7XG5cdFx0XHRkaXNwYXRjaEhvdmVySW4odGFyZ2V0KVxuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBhY3Rpb25CdXR0b24gPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0XHR0aGlzLndhaXRGb3JFbGVtZW50KFxuXHRcdFx0XHRcdHRoaXMucm9vdCxcblx0XHRcdFx0XHQoKSA9PiB0aGlzLl9maW5kQWN0aW9uQnV0dG9uKHRoaXMucm9vdCksXG5cdFx0XHRcdFx0d2FpdEFib3J0Q29udHJvbGxlclxuXHRcdFx0XHQpLFxuXHRcdFx0XHRuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdFx0cHJvbWlzZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHJlamVjdChcIlRpbWVvdXQgc2hvd0FjdGlvbnNNZW51QnV0dG9uXCIpLCAzMDAwKVxuXHRcdFx0XHR9KVxuXHRcdFx0XSlcblxuXHRcdFx0aWYgKGFjdGlvbkJ1dHRvbikge1xuXHRcdFx0XHRyZXR1cm4gYWN0aW9uQnV0dG9uXG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYWN0aW9uQnV0dG9uXG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoKSAvLyBBYm9ydGluZyB3aXRob3V0IHJlYXNvbiBiZWNhdXNlIHRoZSByZWFzb24gaXMgdGhlIGVycm9yIGl0c2VsZlxuXHRcdFx0Y2xlYXJUaW1lb3V0KHByb21pc2VUaW1lb3V0KVxuXHRcdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0YXN5bmMgaGlkZUFjdGlvbk1lbnVCdXR0b24oYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImhpZGVBY3Rpb25NZW51QnV0dG9uXCIsIHRoaXMucm9vdClcblx0XHRkaXNwYXRjaEhvdmVyT3V0KHRoaXMucm9vdClcblxuXHRcdGNvbnN0IG5vbmVFbCA9IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9bm9uZV1cIilcblx0XHRpZiAobm9uZUVsKSB7XG5cdFx0XHRkaXNwYXRjaEhvdmVyT3V0KG5vbmVFbClcblx0XHR9XG5cblx0XHRjb25zdCB3YWl0QWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpXG5cdFx0bGV0IHByb21pc2VUaW1lb3V0XG5cdFx0bGV0IHJlc29sdmVUaW1lb3V0XG5cdFx0Y29uc3QgYWJvcnRIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0d2FpdEFib3J0Q29udHJvbGxlci5hYm9ydChcImhpZGVBY3Rpb25NZW51QnV0dG9uIHN0ZXAgd2FzIGFib3J0ZWQgYnkgdGhlIHBhcmVudCBwcm9jZXNzXCIpXG5cdFx0XHRjbGVhclRpbWVvdXQocHJvbWlzZVRpbWVvdXQpXG5cdFx0XHRpZiAocmVzb2x2ZVRpbWVvdXQpIHtcblx0XHRcdFx0cmVzb2x2ZVRpbWVvdXQoKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdFx0dGhpcy53YWl0Rm9yRWxlbWVudChcblx0XHRcdFx0XHR0aGlzLnJvb3QsXG5cdFx0XHRcdFx0KCkgPT4gdGhpcy5fZmluZEFjdGlvbkJ1dHRvbih0aGlzLnJvb3QpID09PSBudWxsLFxuXHRcdFx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXJcblx0XHRcdFx0KSxcblx0XHRcdFx0bmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRcdHJlc29sdmVUaW1lb3V0ID0gcmVzb2x2ZVxuXHRcdFx0XHRcdHByb21pc2VUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiByZWplY3QoXCJUaW1lb3V0IGhpZGVBY3Rpb25NZW51QnV0dG9uXCIpLCA1MDApXG5cdFx0XHRcdH0pXG5cdFx0XHRdKVxuXHRcdFx0cmV0dXJuIHJlc3VsdFxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR3YWl0QWJvcnRDb250cm9sbGVyLmFib3J0KCkgLy8gQWJvcnRpbmcgd2l0aG91dCByZWFzb24gYmVjYXVzZSB0aGUgcmVhc29uIGlzIHRoZSBlcnJvciBpdHNlbGZcblx0XHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogT3BlbnMgdGhlIGFjdGlvbnMgbWVudSBieSBjbGlja2luZyB0aGUgYWN0aW9uIGJ1dHRvbiBhbmQgd2FpdGluZyBmb3IgdGhlIFwiVW5zZW5kXCIgaXRlbS5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYWN0aW9uQnV0dG9uXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBvcGVuQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAyIDogQ2xpY2tpbmcgYWN0aW9uQnV0dG9uIGFuZCB3YWl0aW5nIGZvciB1bnNlbmQgbWVudSBpdGVtIHRvIGFwcGVhclwiLCBhY3Rpb25CdXR0b24pXG5cdFx0Y29uc3Qgd2FpdEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXHRcdGxldCBwcm9taXNlVGltZW91dFxuXHRcdGxldCByZXNvbHZlVGltZW91dFxuXHRcdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoXCJvcGVuQWN0aW9uc01lbnUgc3RlcCB3YXMgYWJvcnRlZCBieSB0aGUgcGFyZW50IHByb2Nlc3NcIilcblx0XHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRcdGlmIChyZXNvbHZlVGltZW91dCkge1xuXHRcdFx0XHRyZXNvbHZlVGltZW91dCgpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblxuXHRcdC8qKiBDaGVjayBpZiB0ZXh0IG1hdGNoZXMgYW55IGtub3duIFwiVW5zZW5kXCIgdmFyaWFudCAqL1xuXHRcdGNvbnN0IGlzVW5zZW5kVGV4dCA9ICh0ZXh0KSA9PiB7XG5cdFx0XHRjb25zdCBub3JtYWxpemVkID0gdGV4dC50cmltKCkudG9Mb2NhbGVMb3dlckNhc2UoKVxuXHRcdFx0cmV0dXJuIHN0cmluZ3MuVU5TRU5EX1RFWFRfVkFSSUFOVFMuc29tZSh2ID0+IG5vcm1hbGl6ZWQgPT09IHYpXG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHVuc2VuZEJ1dHRvbiA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHRcdHRoaXMuY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcblx0XHRcdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdFx0XHQobXV0YXRpb25zKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAobXV0YXRpb25zKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGFkZGVkTm9kZXMgPSBbLi4ubXV0YXRpb25zLm1hcChtdXRhdGlvbiA9PiBbLi4ubXV0YXRpb24uYWRkZWROb2Rlc10pXS5mbGF0KCkuZmlsdGVyKG5vZGUgPT4gbm9kZS5ub2RlVHlwZSA9PT0gMSlcblx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCBhZGRlZE5vZGUgb2YgYWRkZWROb2Rlcykge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IG5vZGUgPSBbLi4uYWRkZWROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoXCJzcGFuLGRpdlwiKV0uZmluZChub2RlID0+IGlzVW5zZW5kVGV4dChub2RlLnRleHRDb250ZW50KSAmJiBub2RlLmZpcnN0Q2hpbGQ/Lm5vZGVUeXBlID09PSAzKVxuXHRcdFx0XHRcdFx0XHRcdGlmIChub2RlKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAyIDogZm91bmQgdW5zZW5kIG5vZGUgdmlhIG11dGF0aW9uXCIsIG5vZGUpXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gbm9kZVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Ly8gRmFsbGJhY2s6IHNjYW4gdGhlIHdob2xlIGRvY3VtZW50IGZvciBhbiB1bnNlbmQgbWVudSBpdGVtIGFscmVhZHkgcHJlc2VudFxuXHRcdFx0XHRcdFx0Y29uc3QgYWxsU3BhbnMgPSB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiW3JvbGU9bWVudV0gc3BhbiwgW3JvbGU9bWVudV0gZGl2LCBbcm9sZT1tZW51aXRlbV0gc3BhbiwgW3JvbGU9bWVudWl0ZW1dIGRpdlwiKVxuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBzcGFuIG9mIGFsbFNwYW5zKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChpc1Vuc2VuZFRleHQoc3Bhbi50ZXh0Q29udGVudCkgJiYgc3Bhbi5maXJzdENoaWxkPy5ub2RlVHlwZSA9PT0gMykge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgOiBmb3VuZCB1bnNlbmQgbm9kZSB2aWEgZG9jdW1lbnQgc2NhblwiLCBzcGFuKVxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBzcGFuXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXJcblx0XHRcdFx0KSxcblx0XHRcdFx0bmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRcdHByb21pc2VUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiByZWplY3QoXCJUaW1lb3V0IG9wZW5BY3Rpb25zTWVudVwiKSwgMzAwMClcblx0XHRcdFx0fSlcblx0XHRcdF0pXG5cblx0XHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgOiBGb3VuZCB1bnNlbmRCdXR0b25cIiwgdW5zZW5kQnV0dG9uKVxuXHRcdFx0cmV0dXJuIHVuc2VuZEJ1dHRvblxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR3YWl0QWJvcnRDb250cm9sbGVyLmFib3J0KCkgLy8gQWJvcnRpbmcgd2l0aG91dCByZWFzb24gYmVjYXVzZSB0aGUgcmVhc29uIGlzIHRoZSBlcnJvciBpdHNlbGZcblx0XHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ2xvc2VzIHRoZSBhY3Rpb25zIG1lbnUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGFjdGlvbkJ1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBhY3Rpb25zTWVudUVsZW1lbnRcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIGNsb3NlQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhY3Rpb25zTWVudUVsZW1lbnQsIGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJjbG9zZUFjdGlvbnNNZW51XCIpXG5cdFx0Y29uc3Qgd2FpdEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXHRcdGxldCBwcm9taXNlVGltZW91dFxuXHRcdGxldCByZXNvbHZlVGltZW91dFxuXHRcdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoXCJjbG9zZUFjdGlvbnNNZW51IHN0ZXAgd2FzIGFib3J0ZWQgYnkgdGhlIHBhcmVudCBwcm9jZXNzXCIpXG5cdFx0XHRjbGVhclRpbWVvdXQocHJvbWlzZVRpbWVvdXQpXG5cdFx0XHRpZiAocmVzb2x2ZVRpbWVvdXQpIHtcblx0XHRcdFx0cmVzb2x2ZVRpbWVvdXQoKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdFx0dGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0XHRcdGFjdGlvbkJ1dHRvbixcblx0XHRcdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHkuY29udGFpbnMoYWN0aW9uc01lbnVFbGVtZW50KSA9PT0gZmFsc2UsXG5cdFx0XHRcdFx0YWJvcnRDb250cm9sbGVyXG5cdFx0XHRcdCksXG5cdFx0XHRcdG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0XHRwcm9taXNlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gcmVqZWN0KFwiVGltZW91dCBjbG9zZUFjdGlvbnNNZW51XCIpLCA1MDApXG5cdFx0XHRcdH0pXG5cdFx0XHRdKVxuXHRcdFx0cmV0dXJuIHJlc3VsdCAhPT0gbnVsbFxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR3YWl0QWJvcnRDb250cm9sbGVyLmFib3J0KClcblx0XHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ2xpY2sgdW5zZW5kIGJ1dHRvbiBhbmQgd2FpdCBmb3IgdGhlIGNvbmZpcm1hdGlvbiBkaWFsb2cuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTFNwYW5FbGVtZW50fSB1bnNlbmRCdXR0b25cblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxIVE1MQnV0dG9uRWxlbWVudD58UHJvbWlzZTxFcnJvcj59XG5cdCAqL1xuXHRvcGVuQ29uZmlybVVuc2VuZE1vZGFsKHVuc2VuZEJ1dHRvbiwgYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMyA6IENsaWNraW5nIHVuc2VuZEJ1dHRvbiBhbmQgd2FpdGluZyBmb3IgZGlhbG9nIHRvIGFwcGVhci4uLlwiKVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHR1bnNlbmRCdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpLFxuXHRcdFx0YWJvcnRDb250cm9sbGVyXG5cdFx0KVxuXHR9XG5cblx0LyoqXG5cdCAqIENsaWNrIHVuc2VuZCBjb25maXJtIGJ1dHRvbiBpbiB0aGUgbW9kYWwgZGlhbG9nLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBkaWFsb2dCdXR0b25cblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIGNvbmZpcm1VbnNlbmQoZGlhbG9nQnV0dG9uLCBhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgZmluYWwgc3RlcCA6IGNvbmZpcm1VbnNlbmRcIiwgZGlhbG9nQnV0dG9uKVxuXHRcdGF3YWl0IHRoaXMuY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcblx0XHRcdGRpYWxvZ0J1dHRvbixcblx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHQoKSA9PiB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9ZGlhbG9nXSBidXR0b25cIikgPT09IG51bGwsXG5cdFx0XHRhYm9ydENvbnRyb2xsZXJcblx0XHQpXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBVSU1lc3NhZ2VcbiIsIi8qKiBAbW9kdWxlIHVpcGktbWVzc2FnZSBBUEkgZm9yIFVJTWVzc2FnZSAqL1xuXG4vKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnMgKi9cbmltcG9ydCBVSU1lc3NhZ2UgZnJvbSBcIi4uL3VpL2RlZmF1bHQvdWktbWVzc2FnZS5qc1wiXG5cbmNsYXNzIEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uIGV4dGVuZHMgRXJyb3Ige31cblxuY2xhc3MgVUlQSU1lc3NhZ2Uge1xuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge1VJTWVzc2FnZX0gdWlNZXNzYWdlXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aU1lc3NhZ2UpIHtcblx0XHR0aGlzLl91aU1lc3NhZ2UgPSB1aU1lc3NhZ2Vcblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0YXN5bmMgdW5zZW5kKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJTWVzc2FnZSB1bnNlbmRcIilcblx0XHRsZXQgYWN0aW9uQnV0dG9uXG5cdFx0bGV0IHVuc2VuZEJ1dHRvblxuXHRcdHRyeSB7XG5cdFx0XHRhY3Rpb25CdXR0b24gPSBhd2FpdCB0aGlzLnVpTWVzc2FnZS5zaG93QWN0aW9uc01lbnVCdXR0b24oYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0dW5zZW5kQnV0dG9uID0gYXdhaXQgdGhpcy51aU1lc3NhZ2Uub3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcInVuc2VuZEJ1dHRvblwiLCB1bnNlbmRCdXR0b24pXG5cdFx0XHRjb25zdCBkaWFsb2dCdXR0b24gPSBhd2FpdCB0aGlzLnVpTWVzc2FnZS5vcGVuQ29uZmlybVVuc2VuZE1vZGFsKHVuc2VuZEJ1dHRvbiwgYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0YXdhaXQgdGhpcy51aU1lc3NhZ2UuY29uZmlybVVuc2VuZChkaWFsb2dCdXR0b24sIGFib3J0Q29udHJvbGxlcilcblx0XHRcdHRoaXMudWlNZXNzYWdlLnJvb3Quc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LXVuc2VudFwiLCBcIlwiKVxuXHRcdFx0cmV0dXJuIHRydWVcblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdFx0dGhpcy51aU1lc3NhZ2Uucm9vdC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWlkbXUtaWdub3JlXCIsIFwiXCIpXG5cdFx0XHQvLyBEaXNtaXNzIGFueSBvcGVuIG92ZXJsYXkgc28gdGhlIG5leHQgbWVzc2FnZSBzdGFydHMgY2xlYW5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGRvYyA9IHRoaXMudWlNZXNzYWdlLnJvb3Qub3duZXJEb2N1bWVudFxuXHRcdFx0XHRkb2MuYm9keS5kaXNwYXRjaEV2ZW50KG5ldyBLZXlib2FyZEV2ZW50KFwia2V5ZG93blwiLCB7IGtleTogXCJFc2NhcGVcIiwgYnViYmxlczogdHJ1ZSB9KSlcblx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDIwMCkpXG5cdFx0XHRcdC8vIElmIGRpYWxvZyBpcyBzdGlsbCBvcGVuLCBwcmVzcyBFc2NhcGUgYWdhaW5cblx0XHRcdFx0aWYgKGRvYy5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9ZGlhbG9nXVwiKSkge1xuXHRcdFx0XHRcdGRvYy5ib2R5LmRpc3BhdGNoRXZlbnQobmV3IEtleWJvYXJkRXZlbnQoXCJrZXlkb3duXCIsIHsga2V5OiBcIkVzY2FwZVwiLCBidWJibGVzOiB0cnVlIH0pKVxuXHRcdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAyMDApKVxuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKGVycm9yKVxuXHRcdFx0fVxuXHRcdFx0dGhyb3cgbmV3IEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uKFwiRmFpbGVkIHRvIGV4ZWN1dGUgd29ya2Zsb3cgZm9yIHRoaXMgbWVzc2FnZVwiLCBleClcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQHR5cGUge1VJTWVzc2FnZX1cblx0ICovXG5cdGdldCB1aU1lc3NhZ2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VpTWVzc2FnZVxuXHR9XG5cbn1cbmV4cG9ydCB7IEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uIH1cbmV4cG9ydCBkZWZhdWx0IFVJUElNZXNzYWdlXG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcblxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgVUlQSU1lc3NhZ2UgZnJvbSBcIi4uL3VpcGkvdWlwaS1tZXNzYWdlLmpzXCJcblxuLyoqXG4gKlxuICogQGFic3RyYWN0XG4gKi9cbmNsYXNzIFVJIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1VJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdC8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2U+fVxuXHQgKi9cblx0YXN5bmMgZ2V0TmV4dFVJUElNZXNzYWdlKCkge1xuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlcbiIsIi8qKiBAbW9kdWxlIGRvbS1sb29rdXAgVXRpbHMgbW9kdWxlIGZvciBsb29raW5nIHVwIGVsZW1lbnRzIG9uIHRoZSBkZWZhdWx0IFVJICovXG5cbmltcG9ydCB7IHdhaXRGb3JFbGVtZW50IH0gZnJvbSBcIi4uLy4uL2RvbS9hc3luYy1ldmVudHMuanNcIlxuXG4vKipcbiAqIEZpbmRzIHRoZSBzY3JvbGxhYmxlIG1lc3NhZ2VzIGNvbnRhaW5lciBpbnNpZGUgdGhlIGNvbnZlcnNhdGlvbiBwYW5lbC5cbiAqIEluc3RhZ3JhbSByZW1vdmVkIHJvbGU9XCJncmlkXCIg4oCUIHdlIG5vdyBsb2NhdGUgdGhlIGNvbnRhaW5lciB2aWEgYXJpYS1sYWJlbFxuICogYW5kIHdhbGsgaW50byBpdHMgc2Nyb2xsYWJsZSBjaGlsZC5cbiAqXG4gKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR8bnVsbH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRNZXNzYWdlc1dyYXBwZXIod2luZG93KSB7XG5cdGNvbnN0IGNvbnZlcnNhdGlvbiA9IHdpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW2RhdGEtcGFnZWxldD0nSUdETWVzc2FnZXNMaXN0J11cIilcblx0aWYgKCFjb252ZXJzYXRpb24pIHtcblx0XHRyZXR1cm4gbnVsbFxuXHR9XG5cdGNvbnN0IHNjcm9sbGFibGUgPSBmaW5kU2Nyb2xsYWJsZUNoaWxkKGNvbnZlcnNhdGlvbiwgd2luZG93KVxuXHRpZiAoIXNjcm9sbGFibGUpIHtcblx0XHRyZXR1cm4gbnVsbFxuXHR9XG5cdHJldHVybiBzY3JvbGxhYmxlXG59XG5cbi8qKlxuICogUmVjdXJzaXZlbHkgZmluZHMgdGhlIGZpcnN0IHNjcm9sbGFibGUgZGVzY2VuZGFudCBvZiBhIGdpdmVuIGVsZW1lbnQuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBwYXJlbnRcbiAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudHxudWxsfVxuICovXG5leHBvcnQgZnVuY3Rpb24gZmluZFNjcm9sbGFibGVDaGlsZChwYXJlbnQsIHdpbmRvdykge1xuXHRmb3IgKGNvbnN0IGNoaWxkIG9mIHBhcmVudC5jaGlsZHJlbikge1xuXHRcdGNvbnN0IHN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoY2hpbGQpXG5cdFx0aWYgKFxuXHRcdFx0KHN0eWxlLm92ZXJmbG93WSA9PT0gXCJhdXRvXCIgfHwgc3R5bGUub3ZlcmZsb3dZID09PSBcInNjcm9sbFwiKSAmJlxuXHRcdFx0Y2hpbGQuc2Nyb2xsSGVpZ2h0ID4gY2hpbGQuY2xpZW50SGVpZ2h0XG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gY2hpbGRcblx0XHR9XG5cdFx0Y29uc3QgZm91bmQgPSBmaW5kU2Nyb2xsYWJsZUNoaWxkKGNoaWxkLCB3aW5kb3cpXG5cdFx0aWYgKGZvdW5kKSB7XG5cdFx0XHRyZXR1cm4gZm91bmRcblx0XHR9XG5cdH1cblx0cmV0dXJuIG51bGxcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBpbm5lciBjb250YWluZXIgdGhhdCBob2xkcyBpbmRpdmlkdWFsIG1lc3NhZ2Ugcm93IGRpdnMuXG4gKiBUcmF2ZXJzZXMgd3JhcHBlciBsYXllcnMgdG8gZmluZCB0aGUgZGl2IHdpdGggdGhlIG1vc3QgY2hpbGRyZW4gKHRoZSBtZXNzYWdlIGxpc3QpLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gc2Nyb2xsYWJsZVxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TWVzc2FnZXNJbm5lckNvbnRhaW5lcihzY3JvbGxhYmxlKSB7XG5cdC8vIEluc3RhZ3JhbSB3cmFwcyBtZXNzYWdlcyBpbiBzZXZlcmFsIG5lc3RlZCBkaXZzLlxuXHQvLyBTdHJhdGVneTogZmluZCB0aGUgZGVlcGVzdCBkZXNjZW5kYW50ICh3aXRoaW4gMyBsZXZlbHMpIHRoYXQgaGFzIHRoZSBtb3N0IGNoaWxkcmVuLFxuXHQvLyBzaW5jZSB0aGUgYWN0dWFsIG1lc3NhZ2VzIGNvbnRhaW5lciBoYXMgbWFueSBkaXJlY3QgY2hpbGRyZW4gKG9uZSBwZXIgbWVzc2FnZSByb3cpLlxuXHRsZXQgYmVzdCA9IHNjcm9sbGFibGVcblx0bGV0IGJlc3RDb3VudCA9IHNjcm9sbGFibGUuY2hpbGRyZW4ubGVuZ3RoXG5cblx0ZnVuY3Rpb24gc2VhcmNoKGVsLCBkZXB0aCkge1xuXHRcdGlmIChkZXB0aCA+IDMpIHJldHVyblxuXHRcdGZvciAoY29uc3QgY2hpbGQgb2YgZWwuY2hpbGRyZW4pIHtcblx0XHRcdGlmIChjaGlsZC5jaGlsZHJlbi5sZW5ndGggPiBiZXN0Q291bnQpIHtcblx0XHRcdFx0YmVzdCA9IGNoaWxkXG5cdFx0XHRcdGJlc3RDb3VudCA9IGNoaWxkLmNoaWxkcmVuLmxlbmd0aFxuXHRcdFx0fVxuXHRcdFx0c2VhcmNoKGNoaWxkLCBkZXB0aCArIDEpXG5cdFx0fVxuXHR9XG5cblx0c2VhcmNoKHNjcm9sbGFibGUsIDApXG5cdHJldHVybiBiZXN0XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyB3aGV0aGVyIGEgbWVzc2FnZSBlbGVtZW50IHdhcyBzZW50IGJ5IHRoZSBjdXJyZW50IHVzZXIuXG4gKiBJbnN0YWdyYW0gYWxpZ25zIHNlbnQgbWVzc2FnZXMgdG8gdGhlIHJpZ2h0IHVzaW5nIGZsZXhib3ggKGp1c3RpZnktY29udGVudDogZmxleC1lbmQpLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxlbWVudFxuICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1NlbnRCeUN1cnJlbnRVc2VyKGVsZW1lbnQsIHdpbmRvdykge1xuXHQvLyBCRlMgdGhyb3VnaCBhbGwgZGVzY2VuZGFudHMgdXAgdG8gZGVwdGggOC5cblx0Ly8gSW5zdGFncmFtIHBsYWNlcyBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtZW5kIG9uIGEgbmVzdGVkIGRpdiAoZGVwdGggfjUpXG5cdC8vIHRoYXQgbWF5IGJlIG9uIGFueSBjaGlsZCBicmFuY2gsIG5vdCBqdXN0IHRoZSBmaXJzdC1jaGlsZCBwYXRoLlxuXHRjb25zdCBxdWV1ZSA9IFt7IGVsOiBlbGVtZW50LCBkZXB0aDogMCB9XVxuXHR3aGlsZSAocXVldWUubGVuZ3RoID4gMCkge1xuXHRcdGNvbnN0IHsgZWwsIGRlcHRoIH0gPSBxdWV1ZS5zaGlmdCgpXG5cdFx0Y29uc3QgcyA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsKVxuXHRcdGlmIChzLmp1c3RpZnlDb250ZW50ID09PSBcImZsZXgtZW5kXCIpIHtcblx0XHRcdHJldHVybiB0cnVlXG5cdFx0fVxuXHRcdGlmIChkZXB0aCA8IDgpIHtcblx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgZWwuY2hpbGRyZW4pIHtcblx0XHRcdFx0cXVldWUucHVzaCh7IGVsOiBjaGlsZCwgZGVwdGg6IGRlcHRoICsgMSB9KVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gZmFsc2Vcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBmaXJzdCB2aXNpYmxlIG1lc3NhZ2Ugc2VudCBieSB0aGUgY3VycmVudCB1c2VyIHRoYXQgaGFzbid0IGJlZW4gcHJvY2Vzc2VkIHlldC5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3QgLSBUaGUgc2Nyb2xsYWJsZSBtZXNzYWdlcyB3cmFwcGVyXG4gKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG4gKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG4gKiBAcmV0dXJucyB7RWxlbWVudHx1bmRlZmluZWR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRGaXJzdFZpc2libGVNZXNzYWdlKHJvb3QsIGFib3J0Q29udHJvbGxlciwgd2luZG93KSB7XG5cdGNvbnN0IGlubmVyQ29udGFpbmVyID0gZ2V0TWVzc2FnZXNJbm5lckNvbnRhaW5lcihyb290KVxuXHRpZiAoIWlubmVyQ29udGFpbmVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImdldEZpcnN0VmlzaWJsZU1lc3NhZ2U6IG5vIGlubmVyIGNvbnRhaW5lciBmb3VuZFwiKVxuXHRcdHJldHVyblxuXHR9XG5cblx0Y29uc3QgZWxlbWVudHMgPSBbLi4uaW5uZXJDb250YWluZXIuY2hpbGRyZW5dXG5cdFx0LmZpbHRlcihkID0+IHtcblx0XHRcdGlmIChkLmhhc0F0dHJpYnV0ZShcImRhdGEtaWRtdS1pZ25vcmVcIikpIHJldHVybiBmYWxzZVxuXHRcdFx0aWYgKGQuaGFzQXR0cmlidXRlKFwiZGF0YS1pZG11LXVuc2VudFwiKSkgcmV0dXJuIGZhbHNlXG5cdFx0XHQvLyBNdXN0IGNvbnRhaW4gbWVzc2FnZSBjb250ZW50IGluZGljYXRvcnNcblx0XHRcdGNvbnN0IGhhc01lc3NhZ2VDb250ZW50ID0gZC5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9bm9uZV1cIikgfHwgZC5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9cHJlc2VudGF0aW9uXVwiKVxuXHRcdFx0aWYgKCFoYXNNZXNzYWdlQ29udGVudCkgcmV0dXJuIGZhbHNlXG5cdFx0XHRyZXR1cm4gaXNTZW50QnlDdXJyZW50VXNlcihkLCB3aW5kb3cpXG5cdFx0fSlcblxuXHRlbGVtZW50cy5yZXZlcnNlKClcblx0aWYoZWxlbWVudHMubGVuZ3RoID49IDEpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiZ2V0Rmlyc3RWaXNpYmxlTWVzc2FnZVwiLCBlbGVtZW50cy5sZW5ndGgsIFwiY2FuZGlkYXRlIGVsZW1lbnRzXCIpXG5cdH0gZWxzZSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImdldEZpcnN0VmlzaWJsZU1lc3NhZ2U6IG5vIGNhbmRpZGF0ZSBlbGVtZW50cyBmb3VuZFwiKVxuXHR9XG5cblx0Zm9yIChjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG5cdFx0aWYgKGFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcImFib3J0Q29udHJvbGxlciBpbnRlcnVwdGVkIHRoZSBtZXNzYWdlIGZpbHRlcmluZyBwcm9jZXNzOiBzdG9wcGluZy4uLlwiKVxuXHRcdFx0YnJlYWtcblx0XHR9XG5cdFx0Y29uc3QgdmlzaWJpbGl0eUNoZWNrID0gZWxlbWVudC5jaGVja1Zpc2liaWxpdHkoe1xuXHRcdFx0dmlzaWJpbGl0eVByb3BlcnR5OiB0cnVlLFxuXHRcdFx0Y29udGVudFZpc2liaWxpdHlBdXRvOiB0cnVlLFxuXHRcdFx0b3BhY2l0eVByb3BlcnR5OiB0cnVlLFxuXHRcdH0pXG5cdFx0aWYgKHZpc2liaWxpdHlDaGVjayA9PT0gZmFsc2UpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJ2aXNpYmlsaXR5Q2hlY2tcIiwgdmlzaWJpbGl0eUNoZWNrKVxuXHRcdFx0Y29udGludWVcblx0XHR9XG5cdFx0Y29uc3QgcmVjdCA9IGVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcblx0XHQvLyBDaGVjayBpZiBlbGVtZW50IGlzIGF0IGxlYXN0IHBhcnRpYWxseSBpbiB2aWV3cG9ydC5cblx0XHQvLyBGb3IgdGFsbCBlbGVtZW50cyAoaW1hZ2VzLCBsb25nIHRleHQpLCByZWN0LnkgY2FuIGJlIG5lZ2F0aXZlXG5cdFx0Ly8gd2hpbGUgdGhlIGVsZW1lbnQgaXMgc3RpbGwgdmlzaWJsZS4gVXNlIGJvdHRvbSBlZGdlIGluc3RlYWQuXG5cdFx0aWYgKHJlY3QueSArIHJlY3QuaGVpZ2h0IDwgMCB8fCByZWN0LmhlaWdodCA9PT0gMCkge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcImlzSW5WaWV3IGZhaWxlZFwiLCByZWN0LnksIHJlY3QuaGVpZ2h0KVxuXHRcdFx0Y29udGludWVcblx0XHR9XG5cdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWlkbXUtaWdub3JlXCIsIFwiXCIpXG5cdFx0Y29uc29sZS5kZWJ1ZyhcIk1lc3NhZ2UgaW4gdmlldywgdGVzdGluZyB3b3JrZmxvdy4uLlwiLCBlbGVtZW50KVxuXHRcdHJldHVybiBlbGVtZW50XG5cdH1cbn1cblxuLyoqXG4gKiBTY3JvbGxzIHRvIHRvcCB0byB0cmlnZ2VyIGxvYWRpbmcgb2Ygb2xkZXIgbWVzc2FnZXMuXG4gKiBIYW5kbGVzIGJvdGggbm9ybWFsIGFuZCBjb2x1bW4tcmV2ZXJzZSBsYXlvdXRzLlxuICpcbiAqIEluIGNvbHVtbi1yZXZlcnNlIChJbnN0YWdyYW0ncyBjdXJyZW50IGxheW91dCk6XG4gKiAgIHNjcm9sbFRvcD0wIGlzIHRoZSBCT1RUT00gKG5ld2VzdCBtZXNzYWdlcylcbiAqICAgc2Nyb2xsVG9wPS0oc2Nyb2xsSGVpZ2h0LWNsaWVudEhlaWdodCkgaXMgdGhlIFRPUCAob2xkZXN0IG1lc3NhZ2VzKVxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkTW9yZU1lc3NhZ2VzKHJvb3QsIGFib3J0Q29udHJvbGxlcikge1xuXHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlcyBsb29raW5nIGZvciBsb2FkZXIuLi4gXCIpXG5cdGNvbnN0IHNjcm9sbEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXHRsZXQgZmluZExvYWRlclRpbWVvdXRcblx0bGV0IHJlc29sdmVUaW1lb3V0XG5cdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRzY3JvbGxBYm9ydENvbnRyb2xsZXIuYWJvcnQoXCJhYm9ydEhhbmRsZXIgd2FzIGFib3J0ZWRcIilcblx0XHRjbGVhclRpbWVvdXQoZmluZExvYWRlclRpbWVvdXQpXG5cdFx0aWYgKHJlc29sdmVUaW1lb3V0KSB7XG5cdFx0XHRyZXNvbHZlVGltZW91dCgpXG5cdFx0fVxuXHR9XG5cdGFib3J0Q29udHJvbGxlci5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblxuXHQvLyBEZXRlY3QgY29sdW1uLXJldmVyc2UgbGF5b3V0XG5cdGNvbnN0IHN0eWxlID0gcm9vdC5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3LmdldENvbXB1dGVkU3R5bGUocm9vdClcblx0Y29uc3QgaXNSZXZlcnNlZCA9IHN0eWxlLmZsZXhEaXJlY3Rpb24gPT09IFwiY29sdW1uLXJldmVyc2VcIlxuXHQvLyBJbiBjb2x1bW4tcmV2ZXJzZSwgXCJzY3JvbGwgdG8gdG9wXCIgbWVhbnMgbW9zdCBuZWdhdGl2ZSBzY3JvbGxUb3Bcblx0Y29uc3Qgc2Nyb2xsVG9Ub3BWYWx1ZSA9IGlzUmV2ZXJzZWRcblx0XHQ/IC0ocm9vdC5zY3JvbGxIZWlnaHQgLSByb290LmNsaWVudEhlaWdodClcblx0XHQ6IDBcblx0Ly8gSW4gY29sdW1uLXJldmVyc2UsIFwiYXQgdG9wXCIgbWVhbnMgc2Nyb2xsVG9wIGlzIGF0IG9yIG5lYXIgbWluaW11bVxuXHRjb25zdCBpc0F0VG9wID0gKCkgPT4gaXNSZXZlcnNlZFxuXHRcdD8gcm9vdC5zY3JvbGxUb3AgPD0gc2Nyb2xsVG9Ub3BWYWx1ZSArIDVcblx0XHQ6IHJvb3Quc2Nyb2xsVG9wID09PSAwXG5cblx0Y29uc3QgYmVmb3JlU2Nyb2xsID0gcm9vdC5zY3JvbGxUb3Bcblx0Y29uc3QgYmVmb3JlSGVpZ2h0ID0gcm9vdC5zY3JvbGxIZWlnaHRcblx0cm9vdC5zY3JvbGxUb3AgPSBzY3JvbGxUb1RvcFZhbHVlXG5cblx0Ly8gSGVscGVyOiBmaW5kIGEgdmlzaWJsZSBsb2FkZXIgd2l0aGluIHRoZSBzY3JvbGxhYmxlIHJvb3QncyB2aWV3cG9ydFxuXHRjb25zdCBmaW5kVmlzaWJsZUxvYWRlciA9ICgpID0+IHtcblx0XHRjb25zdCBiYXJzID0gcm9vdC5xdWVyeVNlbGVjdG9yQWxsKFwiW3JvbGU9cHJvZ3Jlc3NiYXJdXCIpXG5cdFx0Zm9yIChjb25zdCBiYXIgb2YgYmFycykge1xuXHRcdFx0Y29uc3QgcmVjdCA9IGJhci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuXHRcdFx0Y29uc3Qgcm9vdFJlY3QgPSByb290LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG5cdFx0XHQvLyBNdXN0IGJlIHdpdGhpbiByb290J3MgaG9yaXpvbnRhbCt2ZXJ0aWNhbCBib3VuZHMgYW5kIGhhdmUgZGltZW5zaW9uc1xuXHRcdFx0aWYgKHJlY3QuaGVpZ2h0ID4gMCAmJiByZWN0LnkgPj0gcm9vdFJlY3QueSAtIDEwMCAmJiByZWN0LnkgPD0gcm9vdFJlY3QueSArIHJvb3RSZWN0LmhlaWdodCArIDEwMCkge1xuXHRcdFx0XHRyZXR1cm4gYmFyXG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBudWxsXG5cdH1cblxuXHQvLyBTaG9ydCBjaGF0OiBldmVyeXRoaW5nIGZpdHMgaW4gdmlld3BvcnQsIG5vdGhpbmcgdG8gbG9hZFxuXHRjb25zdCBub1Njcm9sbE5lZWRlZCA9IGlzUmV2ZXJzZWRcblx0XHQ/IGJlZm9yZVNjcm9sbCA9PT0gMCAmJiByb290LnNjcm9sbEhlaWdodCA8PSByb290LmNsaWVudEhlaWdodCArIDUwXG5cdFx0OiBiZWZvcmVTY3JvbGwgPT09IDAgJiYgcm9vdC5zY3JvbGxIZWlnaHQgPD0gcm9vdC5jbGllbnRIZWlnaHQgKyA1MFxuXHRpZiAobm9TY3JvbGxOZWVkZWQpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlczogY2hhdCBmaXRzIGluIHZpZXdwb3J0LCBtYXJraW5nIGFzIGRvbmVcIilcblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0cmV0dXJuIHRydWVcblx0fVxuXG5cdC8vIEFscmVhZHkgYXQgdG9wIGFmdGVyIHNjcm9sbGluZzogd2FpdCBicmllZmx5IGZvciBuZXcgY29udGVudCwgdGhlbiBjaGVja1xuXHRpZiAoaXNBdFRvcCgpKSB7XG5cdFx0Ly8gR2l2ZSBJbnN0YWdyYW0gYSBtb21lbnQgdG8gc3RhcnQgbG9hZGluZyBvbGRlciBtZXNzYWdlc1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCA1MDApKVxuXG5cdFx0Ly8gQ2hlY2sgaWYgYSB2aXNpYmxlIGxvYWRlciBhcHBlYXJlZFxuXHRcdGNvbnN0IGxvYWRlciA9IGZpbmRWaXNpYmxlTG9hZGVyKClcblx0XHRpZiAobG9hZGVyKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlczogRm91bmQgdmlzaWJsZSBsb2FkZXIgYWZ0ZXIgc2Nyb2xsOyB3YWl0aW5nIGZvciByZW1vdmFsIChtYXggNXMpXCIpXG5cdFx0XHRhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0XHR3YWl0Rm9yRWxlbWVudChyb290LCAoKSA9PiBmaW5kVmlzaWJsZUxvYWRlcigpID09PSBudWxsLCBhYm9ydENvbnRyb2xsZXIpLFxuXHRcdFx0XHRuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgNTAwMCkpXG5cdFx0XHRdKVxuXHRcdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdFx0Y29uc3QgZ3JldyA9IHJvb3Quc2Nyb2xsSGVpZ2h0ID4gYmVmb3JlSGVpZ2h0XG5cdFx0XHRjb25zb2xlLmRlYnVnKGBsb2FkTW9yZU1lc3NhZ2VzOiBsb2FkZXIgcGhhc2UgZG9uZSwgY29udGVudCAke2dyZXcgPyBcImdyZXdcIiA6IFwiZGlkIG5vdCBncm93XCJ9YClcblx0XHRcdHJldHVybiAhZ3Jld1xuXHRcdH1cblxuXHRcdC8vIE5vIGxvYWRlciBhcHBlYXJlZCDigJQgY2hlY2sgaWYgc2Nyb2xsSGVpZ2h0IGdyZXcgKG5ldyBjb250ZW50IGxvYWRlZCB3aXRob3V0IHNwaW5uZXIpXG5cdFx0Y29uc3QgZ3JldyA9IHJvb3Quc2Nyb2xsSGVpZ2h0ID4gYmVmb3JlSGVpZ2h0XG5cdFx0aWYgKCFncmV3KSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlczogYXQgdG9wLCBubyBsb2FkZXIsIG5vIG5ldyBjb250ZW50IOKAlCByZWFjaGVkIGxhc3QgcGFnZVwiKVxuXHRcdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdFx0cmV0dXJuIHRydWVcblx0XHR9XG5cdH1cblxuXHQvLyBGYWxsYmFjazogd2FpdCBmb3IgcHJvZ3Jlc3NiYXIgdG8gYXBwZWFyICh3aXRoIHNob3J0ZXIgdGltZW91dClcblx0bGV0IGxvYWRpbmdFbGVtZW50XG5cdHRyeSB7XG5cdFx0bG9hZGluZ0VsZW1lbnQgPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0d2FpdEZvckVsZW1lbnQocm9vdCwgKCkgPT4ge1xuXHRcdFx0XHRpZiAoZmluZFZpc2libGVMb2FkZXIoKSA9PT0gbnVsbCkge1xuXHRcdFx0XHRcdHJvb3Quc2Nyb2xsVG9wID0gc2Nyb2xsVG9Ub3BWYWx1ZVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmaW5kVmlzaWJsZUxvYWRlcigpXG5cdFx0XHR9LCBzY3JvbGxBYm9ydENvbnRyb2xsZXIpLFxuXHRcdFx0bmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdHJlc29sdmVUaW1lb3V0ID0gcmVzb2x2ZVxuXHRcdFx0XHRmaW5kTG9hZGVyVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdHJlc29sdmUoKVxuXHRcdFx0XHR9LCAzMDAwKVxuXHRcdFx0fSlcblx0XHRdKVxuXHR9IGNhdGNoIChleCkge1xuXHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdH1cblx0c2Nyb2xsQWJvcnRDb250cm9sbGVyLmFib3J0KFwiU2Nyb2xsaW5nIHRvb2sgdG9vIG11Y2ggdGltZS4gVGltZW91dCBhZnRlciAxMHNcIilcblx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRjbGVhclRpbWVvdXQoZmluZExvYWRlclRpbWVvdXQpXG5cdGlmIChsb2FkaW5nRWxlbWVudCAmJiBsb2FkaW5nRWxlbWVudCAhPT0gdHJ1ZSkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VzOiBGb3VuZCBsb2FkZXI7IFN0YW5kLWJ5IHVudGlsIGl0IGlzIHJlbW92ZWQgKG1heCA1cylcIilcblx0XHRhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0d2FpdEZvckVsZW1lbnQocm9vdCwgKCkgPT4gZmluZFZpc2libGVMb2FkZXIoKSA9PT0gbnVsbCwgYWJvcnRDb250cm9sbGVyKSxcblx0XHRcdG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCA1MDAwKSlcblx0XHRdKVxuXHR9XG5cdGNvbnN0IGF0VG9wID0gaXNBdFRvcCgpXG5cdGNvbnNvbGUuZGVidWcoYGxvYWRNb3JlTWVzc2FnZXM6IHNjcm9sbFRvcCBpcyAke3Jvb3Quc2Nyb2xsVG9wfSDigJQgJHthdFRvcCA/IFwicmVhY2hlZCBsYXN0IHBhZ2VcIiA6IFwibm90IGxhc3QgcGFnZVwifWApXG5cdHJldHVybiBhdFRvcFxufVxuIiwiLyoqIEBtb2R1bGUgdWktbWVzc2FnZXMtd3JhcHBlciBVSSBlbGVtZW50IHJlcHJlc2VudGluZyB0aGUgbWVzc2FnZXMgd3JhcHBlciAqL1xuXG5pbXBvcnQgeyBsb2FkTW9yZU1lc3NhZ2VzIH0gZnJvbSBcIi4vZG9tLWxvb2t1cC5qc1wiXG5pbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4uL3VpLWNvbXBvbmVudC5qc1wiXG5cbmNsYXNzIFVJTWVzc2FnZXNXcmFwcGVyIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0ZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0cmV0dXJuIGxvYWRNb3JlTWVzc2FnZXModGhpcy5yb290LCBhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBVSU1lc3NhZ2VzV3JhcHBlclxuIiwiLyoqIEBtb2R1bGUgZGVmYXVsdC11aSBEZWZhdWx0IFVJIC8gRW5nbGlzaCBVSSAqL1xuXG5pbXBvcnQgVUkgZnJvbSBcIi4uL3VpLmpzXCJcbmltcG9ydCB7IGZpbmRNZXNzYWdlc1dyYXBwZXIsIGdldEZpcnN0VmlzaWJsZU1lc3NhZ2UgfSBmcm9tIFwiLi9kb20tbG9va3VwLmpzXCJcbmltcG9ydCBVSVBJTWVzc2FnZSBmcm9tIFwiLi4vLi4vdWlwaS91aXBpLW1lc3NhZ2UuanNcIlxuaW1wb3J0IFVJTWVzc2FnZSBmcm9tIFwiLi91aS1tZXNzYWdlLmpzXCJcbmltcG9ydCBVSU1lc3NhZ2VzV3JhcHBlciBmcm9tIFwiLi91aS1tZXNzYWdlcy13cmFwcGVyLmpzXCJcblxuY2xhc3MgRGVmYXVsdFVJIGV4dGVuZHMgVUkge1xuXG5cdGNvbnN0cnVjdG9yKHJvb3QsIGlkZW50aWZpZXIgPSB7fSkge1xuXHRcdHN1cGVyKHJvb3QsIGlkZW50aWZpZXIpXG5cdFx0dGhpcy5sYXN0U2Nyb2xsVG9wID0gbnVsbFxuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcblx0ICogQHJldHVybnMge0RlZmF1bHRVSX1cblx0ICovXG5cdHN0YXRpYyBjcmVhdGUod2luZG93KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJIGNyZWF0ZTogTG9va2luZyBmb3IgbWVzc2FnZXNXcmFwcGVyRWxlbWVudFwiKVxuXHRcdGNvbnN0IG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQgPSBmaW5kTWVzc2FnZXNXcmFwcGVyKHdpbmRvdylcblx0XHRpZiAobWVzc2FnZXNXcmFwcGVyRWxlbWVudCAhPT0gbnVsbCkge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIkZvdW5kIG1lc3NhZ2VzV3JhcHBlckVsZW1lbnRcIiwgbWVzc2FnZXNXcmFwcGVyRWxlbWVudClcblx0XHRcdGNvbnN0IHVpTWVzc2FnZXNXcmFwcGVyID0gbmV3IFVJTWVzc2FnZXNXcmFwcGVyKG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQpXG5cdFx0XHRyZXR1cm4gbmV3IERlZmF1bHRVSSh3aW5kb3csIHsgdWlNZXNzYWdlc1dyYXBwZXIgfSlcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIGZpbmQgbWVzc2FnZXNXcmFwcGVyRWxlbWVudC4gVGhlIHF1ZXJ5IHNlbGVjdG9yIG1pZ2h0IGJlIG91dCBvZiBkYXRlLlwiKVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlXCIpXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlci5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxuXHQvKipcblx0ICogU2Nyb2xsIHVudGlsIGEgKHZpc2libGUpIG1lc3NhZ2UgaXMgZm91bmQgYW5kIHJldHVybiBpdC5cblx0ICpcblx0ICogSW5zdGFncmFtIHVzZXMgZmxleC1kaXJlY3Rpb246IGNvbHVtbi1yZXZlcnNlIG9uIHRoZSBtZXNzYWdlcyBjb250YWluZXIuXG5cdCAqIFRoaXMgbWVhbnMgc2Nyb2xsVG9wPTAgaXMgdGhlIEJPVFRPTSAobmV3ZXN0IG1lc3NhZ2VzKSBhbmQgc2Nyb2xsaW5nIHRvXG5cdCAqIG9sZGVyIG1lc3NhZ2VzIHJlcXVpcmVzIE5FR0FUSVZFIHNjcm9sbFRvcCB2YWx1ZXMuXG5cdCAqIEluIG5vcm1hbCAobm9uLXJldmVyc2VkKSBsYXlvdXRzLCBzY3JvbGxUb3A9MCBpcyB0aGUgdG9wIGFuZCB0aGUgbWF4IGlzIHBvc2l0aXZlLlxuXHQgKlxuXHQgKiBUaGlzIG1ldGhvZCBkZXRlY3RzIHRoZSBsYXlvdXQgZGlyZWN0aW9uIGFuZCBzY3JvbGxzIGFjY29yZGluZ2x5LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlfGZhbHNlPn1cblx0ICovXG5cdGFzeW5jIGdldE5leHRVSVBJTWVzc2FnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUkgZ2V0TmV4dFVJUElNZXNzYWdlXCIsIHRoaXMubGFzdFNjcm9sbFRvcClcblx0XHRjb25zdCB1aU1lc3NhZ2VzV3JhcHBlclJvb3QgPSB0aGlzLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIucm9vdFxuXG5cdFx0Ly8gRGV0ZWN0IGNvbHVtbi1yZXZlcnNlOiBzY3JvbGxUb3AgY2FuIGdvIG5lZ2F0aXZlXG5cdFx0Y29uc3Qgc3R5bGUgPSB0aGlzLnJvb3QuZ2V0Q29tcHV0ZWRTdHlsZVxuXHRcdFx0PyB0aGlzLnJvb3QuZ2V0Q29tcHV0ZWRTdHlsZSh1aU1lc3NhZ2VzV3JhcHBlclJvb3QpXG5cdFx0XHQ6IHVpTWVzc2FnZXNXcmFwcGVyUm9vdC5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3LmdldENvbXB1dGVkU3R5bGUodWlNZXNzYWdlc1dyYXBwZXJSb290KVxuXHRcdGNvbnN0IGlzUmV2ZXJzZWQgPSBzdHlsZS5mbGV4RGlyZWN0aW9uID09PSBcImNvbHVtbi1yZXZlcnNlXCJcblxuXHRcdC8vIFByZS1jaGVjazogdHJ5IGZpbmRpbmcgYSBtZXNzYWdlIGF0IHRoZSBjdXJyZW50IHNjcm9sbCBwb3NpdGlvbiB3aXRob3V0IHNjcm9sbGluZy5cblx0XHQvLyBUaGlzIGNhdGNoZXMgbWVzc2FnZXMgYWxyZWFkeSB2aXNpYmxlIGluIHZpZXdwb3J0IChjb21tb24gZm9yIHNob3J0IGNvbnZlcnNhdGlvbnNcblx0XHQvLyBhbmQgYWZ0ZXIgdW5zZW5kaW5nIHdoZW4gdGhlIERPTSBzaHJpbmtzKS5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgbWVzc2FnZUVsZW1lbnQgPSBnZXRGaXJzdFZpc2libGVNZXNzYWdlKHVpTWVzc2FnZXNXcmFwcGVyUm9vdCwgYWJvcnRDb250cm9sbGVyLCB0aGlzLnJvb3QpXG5cdFx0XHRpZiAobWVzc2FnZUVsZW1lbnQpIHtcblx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhcImdldE5leHRVSVBJTWVzc2FnZTogZm91bmQgbWVzc2FnZSB3aXRob3V0IHNjcm9sbGluZ1wiKVxuXHRcdFx0XHRjb25zdCB1aU1lc3NhZ2UgPSBuZXcgVUlNZXNzYWdlKG1lc3NhZ2VFbGVtZW50KVxuXHRcdFx0XHRyZXR1cm4gbmV3IFVJUElNZXNzYWdlKHVpTWVzc2FnZSlcblx0XHRcdH1cblx0XHR9IGNhdGNoIChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHR9XG5cblx0XHQvLyBBbGxvdyB1cCB0byAzIGZ1bGwgcGFzc2VzOyBjb3ZlcnMgY2FzZXMgd2hlcmUgRE9NIHNocmlua3MgYWZ0ZXIgdW5zZW5kc1xuXHRcdGZvciAobGV0IHBhc3MgPSAwOyBwYXNzIDwgMzsgcGFzcysrKSB7XG5cdFx0XHRpZiAoYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdGNvbnNvbGUuZGVidWcoXCJhYm9ydENvbnRyb2xsZXIgaW50ZXJ1cHRlZCB0aGUgc2Nyb2xsaW5nOiBzdG9wcGluZy4uLlwiKVxuXHRcdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHRcdH1cblxuXHRcdFx0aWYgKGlzUmV2ZXJzZWQpIHtcblx0XHRcdFx0Ly8gY29sdW1uLXJldmVyc2U6IHNjcm9sbFRvcCByYW5nZXMgZnJvbSAwIChib3R0b20vbmV3ZXN0KSB0byBuZWdhdGl2ZSAodG9wL29sZGVzdClcblx0XHRcdFx0Y29uc3QgbWluU2Nyb2xsID0gLSh1aU1lc3NhZ2VzV3JhcHBlclJvb3Quc2Nyb2xsSGVpZ2h0IC0gdWlNZXNzYWdlc1dyYXBwZXJSb290LmNsaWVudEhlaWdodClcblx0XHRcdFx0Y29uc3Qgc3RhcnRQb3MgPSAocGFzcyA9PT0gMCAmJiB0aGlzLmxhc3RTY3JvbGxUb3AgIT09IG51bGwpXG5cdFx0XHRcdFx0PyBNYXRoLm1heCh0aGlzLmxhc3RTY3JvbGxUb3AsIG1pblNjcm9sbClcblx0XHRcdFx0XHQ6IDAgLy8gU3RhcnQgZnJvbSBib3R0b20gKG5ld2VzdClcblxuXHRcdFx0XHQvLyBVc2Ugc21hbGxlciBpbmNyZW1lbnRzIGZvciBzaG9ydCBjb252ZXJzYXRpb25zIHRvIGF2b2lkIG92ZXJzaG9vdGluZ1xuXHRcdFx0XHRjb25zdCB0b3RhbFJhbmdlID0gTWF0aC5hYnMobWluU2Nyb2xsKVxuXHRcdFx0XHRjb25zdCBzdGVwID0gdG90YWxSYW5nZSA8IDUwMCA/IDMwIDogMTUwXG5cblx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhgZ2V0TmV4dFVJUElNZXNzYWdlIFtyZXZlcnNlZF0gcGFzcz0ke3Bhc3N9LCBzdGFydFBvcz0ke3N0YXJ0UG9zfSwgbWluU2Nyb2xsPSR7bWluU2Nyb2xsfSwgc3RlcD0ke3N0ZXB9YClcblxuXHRcdFx0XHRmb3IgKGxldCBpID0gc3RhcnRQb3M7IGkgPj0gbWluU2Nyb2xsOyBpID0gaSAtIHN0ZXApIHtcblx0XHRcdFx0XHRpZiAoYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiYWJvcnRDb250cm9sbGVyIGludGVydXB0ZWQgdGhlIHNjcm9sbGluZzogc3RvcHBpbmcuLi5cIilcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLmxhc3RTY3JvbGxUb3AgPSBpXG5cdFx0XHRcdFx0dWlNZXNzYWdlc1dyYXBwZXJSb290LnNjcm9sbFRvcCA9IGlcblx0XHRcdFx0XHR1aU1lc3NhZ2VzV3JhcHBlclJvb3QuZGlzcGF0Y2hFdmVudChuZXcgdGhpcy5yb290LkV2ZW50KFwic2Nyb2xsXCIpKVxuXHRcdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCA1KSlcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0Y29uc3QgbWVzc2FnZUVsZW1lbnQgPSBnZXRGaXJzdFZpc2libGVNZXNzYWdlKHVpTWVzc2FnZXNXcmFwcGVyUm9vdCwgYWJvcnRDb250cm9sbGVyLCB0aGlzLnJvb3QpXG5cdFx0XHRcdFx0XHRpZiAobWVzc2FnZUVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgdWlNZXNzYWdlID0gbmV3IFVJTWVzc2FnZShtZXNzYWdlRWxlbWVudClcblx0XHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBVSVBJTWVzc2FnZSh1aU1lc3NhZ2UpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXgpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBOb3JtYWwgbGF5b3V0OiBzY3JvbGxUb3AgcmFuZ2VzIGZyb20gMCAodG9wKSB0byBwb3NpdGl2ZSBtYXggKGJvdHRvbSlcblx0XHRcdFx0Y29uc3QgbWF4U2Nyb2xsID0gdWlNZXNzYWdlc1dyYXBwZXJSb290LnNjcm9sbEhlaWdodCAtIHVpTWVzc2FnZXNXcmFwcGVyUm9vdC5jbGllbnRIZWlnaHRcblx0XHRcdFx0Y29uc3Qgc3RhcnRTY3JvbGxUb3AgPSAocGFzcyA9PT0gMCAmJiB0aGlzLmxhc3RTY3JvbGxUb3AgIT09IG51bGwpXG5cdFx0XHRcdFx0PyBNYXRoLm1pbih0aGlzLmxhc3RTY3JvbGxUb3AsIG1heFNjcm9sbClcblx0XHRcdFx0XHQ6IG1heFNjcm9sbFxuXG5cdFx0XHRcdC8vIFVzZSBzbWFsbGVyIGluY3JlbWVudHMgZm9yIHNob3J0IGNvbnZlcnNhdGlvbnNcblx0XHRcdFx0Y29uc3Qgc3RlcCA9IG1heFNjcm9sbCA8IDUwMCA/IDMwIDogMTUwXG5cblx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhgZ2V0TmV4dFVJUElNZXNzYWdlIHBhc3M9JHtwYXNzfSwgc3RhcnRTY3JvbGxUb3A9JHtzdGFydFNjcm9sbFRvcH0sIG1heFNjcm9sbD0ke21heFNjcm9sbH0sIHN0ZXA9JHtzdGVwfWApXG5cblx0XHRcdFx0Zm9yIChsZXQgaSA9IE1hdGgubWF4KDEsIHN0YXJ0U2Nyb2xsVG9wKTsgaSA+IDA7IGkgPSBpIC0gc3RlcCkge1xuXHRcdFx0XHRcdGlmIChhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZGVidWcoXCJhYm9ydENvbnRyb2xsZXIgaW50ZXJ1cHRlZCB0aGUgc2Nyb2xsaW5nOiBzdG9wcGluZy4uLlwiKVxuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMubGFzdFNjcm9sbFRvcCA9IGlcblx0XHRcdFx0XHR1aU1lc3NhZ2VzV3JhcHBlclJvb3Quc2Nyb2xsVG9wID0gaVxuXHRcdFx0XHRcdHVpTWVzc2FnZXNXcmFwcGVyUm9vdC5kaXNwYXRjaEV2ZW50KG5ldyB0aGlzLnJvb3QuRXZlbnQoXCJzY3JvbGxcIikpXG5cdFx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDUpKVxuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRjb25zdCBtZXNzYWdlRWxlbWVudCA9IGdldEZpcnN0VmlzaWJsZU1lc3NhZ2UodWlNZXNzYWdlc1dyYXBwZXJSb290LCBhYm9ydENvbnRyb2xsZXIsIHRoaXMucm9vdClcblx0XHRcdFx0XHRcdGlmIChtZXNzYWdlRWxlbWVudCkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCB1aU1lc3NhZ2UgPSBuZXcgVUlNZXNzYWdlKG1lc3NhZ2VFbGVtZW50KVxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gbmV3IFVJUElNZXNzYWdlKHVpTWVzc2FnZSlcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGNhdGNoIChleCkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVhY2hlZCB0aGUgZW5kIHdpdGhvdXQgZmluZGluZyBhIG1lc3NhZ2UuXG5cdFx0XHQvLyBSZXNldCBmb3IgYSBmcmVzaCBwYXNzIChET00gbWF5IGhhdmUgc2hydW5rIGFmdGVyIHVuc2VuZHMpLlxuXHRcdFx0dGhpcy5sYXN0U2Nyb2xsVG9wID0gbnVsbFxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhgZ2V0TmV4dFVJUElNZXNzYWdlOiBwYXNzICR7cGFzc30gZm91bmQgbm90aGluZywgcmV0cnlpbmdgKVxuXHRcdH1cblxuXHRcdGNvbnNvbGUuZGVidWcoXCJnZXROZXh0VUlQSU1lc3NhZ2U6IGV4aGF1c3RlZCBhbGwgcGFzc2VzLCBubyBtZXNzYWdlcyBsZWZ0XCIpXG5cdFx0cmV0dXJuIGZhbHNlXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBEZWZhdWx0VUlcbiIsIi8qKiBAbW9kdWxlIGdldC11aSBVSSBsb2FkZXIgbW9kdWxlLiBBbGxvdyBsb2FkaW5nIG9mIGEgY2VydGFpbiBVSSBiYXNlZCBvbiBhIGdpdmVuIHN0cmF0ZWd5IChsb2NhbGUgZXRjLi4pXG4gKiBUaGVyZSBtaWdodCBiZSBuZWVkIGZvciBtdWx0aXBsZSBVSSBhcyBJbnN0YWdyYW0gbWlnaHQgc2VydmUgZGlmZmVyZW50IGFwcHMgYmFzZWQgb24gbG9jYXRpb24gZm9yIGV4YW1wbGUuXG4gKiBUaGVyZSBpcyBhbHNvIGEgbmVlZCB0byBpbnRlcm5hdGlvbmFsaXplIGVhY2ggdWkgc28gdGhhdCBpdCBkb2Vzbid0IGZhaWwgaWYgd2UgY2hhbmdlIHRoZSBsYW5ndWFnZS5cbiAqL1xuXG5pbXBvcnQgRGVmYXVsdFVJIGZyb20gXCIuL2RlZmF1bHQvZGVmYXVsdC11aS5qc1wiXG4vKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnMgKi9cbmltcG9ydCBVSSBmcm9tIFwiLi91aS5qc1wiXG5cbi8qKlxuICpcbiAqIEByZXR1cm5zIHtVSX1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0VUkoKSB7XG5cdHJldHVybiBEZWZhdWx0VUlcbn1cbiIsIi8qKiBAbW9kdWxlIHVpcGkgQVBJIGZvciBVSSAqL1xuXG5pbXBvcnQgZ2V0VUkgZnJvbSBcIi4uL3VpL2dldC11aS5qc1wiXG5cbi8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyAqL1xuaW1wb3J0IFVJIGZyb20gXCIuLi91aS91aS5qc1wiXG4vKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnMgKi9cbmltcG9ydCBVSVBJTWVzc2FnZSBmcm9tIFwiLi91aXBpLW1lc3NhZ2UuanNcIlxuXG4vKipcbiAqIFVJIEludGVyZmFjZSBBUElcbiAqL1xuY2xhc3MgVUlQSSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUl9IHVpXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aSkge1xuXHRcdHRoaXMuX3VpID0gdWlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG5cdCAqIEByZXR1cm5zIHtVSVBJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSh3aW5kb3cpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSS5jcmVhdGVcIilcblx0XHRjb25zdCB1aSA9IGdldFVJKCkuY3JlYXRlKHdpbmRvdylcblx0XHRyZXR1cm4gbmV3IFVJUEkodWkpXG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlXCIpXG5cdFx0cmV0dXJuIHRoaXMudWkuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2U+fVxuXHQgKi9cblx0Z2V0TmV4dFVJUElNZXNzYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJIGdldE5leHRVSVBJTWVzc2FnZVwiKVxuXHRcdHJldHVybiB0aGlzLnVpLmdldE5leHRVSVBJTWVzc2FnZShhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHR5cGUge1VJfVxuXHQgKi9cblx0Z2V0IHVpKCkge1xuXHRcdHJldHVybiB0aGlzLl91aVxuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlQSVxuIiwiLyoqIEBtb2R1bGUgaWRtdSBHbG9iYWwvTWFpbiBBUEkgZm9yIGludGVyYWN0aW5nIHdpdGggdGhlIFVJICovXG5cbmltcG9ydCBVSVBJIGZyb20gXCIuLi91aXBpL3VpcGkuanNcIlxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgVUlQSU1lc3NhZ2UgZnJvbSBcIi4uL3VpcGkvdWlwaS1tZXNzYWdlLmpzXCJcblxuY2xhc3MgSURNVSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcblx0ICogQHBhcmFtIHtjYWxsYmFja30gb25TdGF0dXNUZXh0XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih3aW5kb3csIG9uU3RhdHVzVGV4dCkge1xuXHRcdHRoaXMud2luZG93ID0gd2luZG93XG5cdFx0dGhpcy51aXBpID0gbnVsbFxuXHRcdHRoaXMub25TdGF0dXNUZXh0ID0gb25TdGF0dXNUZXh0XG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZT59XG5cdCAqL1xuXHRnZXROZXh0VUlQSU1lc3NhZ2UoYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0cmV0dXJuIHRoaXMudWlwaS5nZXROZXh0VUlQSU1lc3NhZ2UoYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XG5cdCAqL1xuXHRzZXRTdGF0dXNUZXh0KHRleHQpIHtcblx0XHR0aGlzLm9uU3RhdHVzVGV4dCh0ZXh0KVxuXHR9XG5cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdHJldHVybiB0aGlzLnVpcGkuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cblx0LyoqXG5cdCAqIE1hcCBJbnN0YWdyYW0gVUlcblx0ICovXG5cdGxvYWRVSVBJKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkVUlQSVwiKVxuXHRcdHRoaXMudWlwaSA9IFVJUEkuY3JlYXRlKHRoaXMud2luZG93KVxuXHR9XG5cblxufVxuZXhwb3J0IGRlZmF1bHQgSURNVVxuIiwiLyoqIEBtb2R1bGUgdW5zZW5kLXN0cmF0ZWd5IFZhcmlvdXMgc3RyYXRlZ2llcyBmb3IgdW5zZW5kaW5nIG1lc3NhZ2VzICovXG5cbi8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyAqL1xuaW1wb3J0IElETVUgZnJvbSBcIi4uL2lkbXUvaWRtdS5qc1wiXG5cbi8qKlxuICpcbiAqIEBhYnN0cmFjdFxuICovXG5jbGFzcyBVbnNlbmRTdHJhdGVneSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SURNVX0gaWRtdVxuXHQgKi9cblx0Y29uc3RydWN0b3IoaWRtdSkge1xuXHRcdHRoaXMuX2lkbXUgPSBpZG11XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQGFic3RyYWN0XG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0aXNSdW5uaW5nKCkge1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKi9cblx0c3RvcCgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICovXG5cdHJlc2V0KCkge1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKi9cblx0YXN5bmMgcnVuKCkge1xuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SURNVX1cblx0ICovXG5cdGdldCBpZG11KCkge1xuXHRcdHJldHVybiB0aGlzLl9pZG11XG5cdH1cblxufVxuXG5leHBvcnQgeyBVbnNlbmRTdHJhdGVneSB9XG4iLCIvKiogQG1vZHVsZSB1bnNlbmQtc3RyYXRlZ3kgVmFyaW91cyBzdHJhdGVnaWVzIGZvciB1bnNlbmRpbmcgbWVzc2FnZXMgKi9cblxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgSURNVSBmcm9tIFwiLi4vLi4vaWRtdS9pZG11LmpzXCJcbmltcG9ydCB7IFVuc2VuZFN0cmF0ZWd5IH0gZnJvbSBcIi4uL3Vuc2VuZC1zdHJhdGVneS5qc1wiXG5cbi8qKlxuICogTG9hZHMgYWxsIHBhZ2VzIGZpcnN0LCB0aGVuIHVuc2VuZHMgbWVzc2FnZXMgZnJvbSBib3R0b20gdG8gdG9wLlxuICogRm9yIHNob3J0IGNvbnZlcnNhdGlvbnMgKGFsbCBtZXNzYWdlcyBmaXQgaW4gdmlld3BvcnQpLCBza2lwcyBwYWdlIGxvYWRpbmcgZW50aXJlbHkuXG4gKi9cbmNsYXNzIERlZmF1bHRTdHJhdGVneSBleHRlbmRzIFVuc2VuZFN0cmF0ZWd5IHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtJRE1VfSBpZG11XG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpZG11KSB7XG5cdFx0c3VwZXIoaWRtdSlcblx0XHR0aGlzLl9hbGxQYWdlc0xvYWRlZCA9IGZhbHNlXG5cdFx0dGhpcy5fdW5zZW50Q291bnQgPSAwXG5cdFx0dGhpcy5fcGFnZXNMb2FkZWRDb3VudCA9IDBcblx0XHR0aGlzLl9ydW5uaW5nID0gZmFsc2Vcblx0XHR0aGlzLl9hYm9ydENvbnRyb2xsZXIgPSBudWxsXG5cdFx0dGhpcy5fbGFzdFVuc2VuZERhdGUgPSBudWxsXG5cdFx0dGhpcy5fY29uc2VjdXRpdmVGYWlsdXJlcyA9IDBcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cblx0ICovXG5cdGlzUnVubmluZygpIHtcblx0XHRyZXR1cm4gdGhpcy5fcnVubmluZyAmJiB0aGlzLl9hYm9ydENvbnRyb2xsZXIgJiYgdGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkID09PSBmYWxzZVxuXHR9XG5cblx0c3RvcCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IHN0b3BcIilcblx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChcIlN0b3BwaW5nLi4uXCIpXG5cdFx0dGhpcy5fYWJvcnRDb250cm9sbGVyLmFib3J0KFwiRGVmYXVsdFN0cmF0ZWd5IHN0b3BwZWRcIilcblx0fVxuXG5cdHJlc2V0KCkge1xuXHRcdHRoaXMuX2FsbFBhZ2VzTG9hZGVkID0gZmFsc2Vcblx0XHR0aGlzLl91bnNlbnRDb3VudCA9IDBcblx0XHR0aGlzLl9sYXN0VW5zZW5kRGF0ZSA9IG51bGxcblx0XHR0aGlzLl9wYWdlc0xvYWRlZENvdW50ID0gMFxuXHRcdHRoaXMuX2NvbnNlY3V0aXZlRmFpbHVyZXMgPSAwXG5cdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoXCJSZWFkeVwiKVxuXHR9XG5cblx0LyoqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgcnVuKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJEZWZhdWx0U3RyYXRlZ3kucnVuKClcIilcblx0XHR0aGlzLl91bnNlbnRDb3VudCA9IDBcblx0XHR0aGlzLl9wYWdlc0xvYWRlZENvdW50ID0gMFxuXHRcdHRoaXMuX2NvbnNlY3V0aXZlRmFpbHVyZXMgPSAwXG5cdFx0dGhpcy5fcnVubmluZyA9IHRydWVcblx0XHR0aGlzLl9hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcblx0XHQvLyBDbGVhciBzdGFsZSBpZ25vcmUgbWFya2VycyBmcm9tIHByZXZpb3VzIHJ1bnMgc28gbWVzc2FnZXMgY2FuIGJlIHJldHJpZWRcblx0XHR0aGlzLmlkbXUud2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbZGF0YS1pZG11LWlnbm9yZV1cIikuZm9yRWFjaChlbCA9PiB7XG5cdFx0XHRlbC5yZW1vdmVBdHRyaWJ1dGUoXCJkYXRhLWlkbXUtaWdub3JlXCIpXG5cdFx0fSlcblx0XHR0aGlzLmlkbXUubG9hZFVJUEkoKVxuXHRcdHRyeSB7XG5cdFx0XHRpZiAodGhpcy5fYWxsUGFnZXNMb2FkZWQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy4jdW5zZW5kTmV4dE1lc3NhZ2UoKVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXdhaXQgdGhpcy4jbG9hZE5leHRQYWdlKClcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmFjZSBjb25kaXRpb246IG9uIGZpcnN0IHBhZ2UgbG9hZCwgSW5zdGFncmFtJ3MgUmVhY3QgbWF5IG5vdCBoYXZlXG5cdFx0XHQvLyBmaW5pc2hlZCBoeWRyYXRpbmcgbWVzc2FnZSBjb21wb25lbnRzIChyb2xlIGF0dHJpYnV0ZXMgbWlzc2luZykuXG5cdFx0XHQvLyBJZiB3ZSBmb3VuZCBub3RoaW5nLCB3YWl0IGFuZCByZS1zY2FuIHVwIHRvIDMgdGltZXMuXG5cdFx0XHRpZiAodGhpcy5fdW5zZW50Q291bnQgPT09IDAgJiYgIXRoaXMuX2Fib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuXHRcdFx0XHRmb3IgKGxldCByZXRyeSA9IDE7IHJldHJ5IDw9IDM7IHJldHJ5KyspIHtcblx0XHRcdFx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChgTm8gbWVzc2FnZXMgZGV0ZWN0ZWQsIHJldHJ5aW5nICgke3JldHJ5fS8zKS4uLmApXG5cdFx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhgRGVmYXVsdFN0cmF0ZWd5OiAwIG1lc3NhZ2VzIGZvdW5kLCByZXRyeSAke3JldHJ5fS8zYClcblx0XHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMjAwMCkpXG5cdFx0XHRcdFx0aWYgKHRoaXMuX2Fib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkgYnJlYWtcblx0XHRcdFx0XHQvLyBSZXNldCBmb3IgZnJlc2ggc2NhblxuXHRcdFx0XHRcdHRoaXMuX2FsbFBhZ2VzTG9hZGVkID0gZmFsc2Vcblx0XHRcdFx0XHR0aGlzLl9jb25zZWN1dGl2ZUZhaWx1cmVzID0gMFxuXHRcdFx0XHRcdHRoaXMuaWRtdS53aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIltkYXRhLWlkbXUtaWdub3JlXVwiKS5mb3JFYWNoKGVsID0+IHtcblx0XHRcdFx0XHRcdGVsLnJlbW92ZUF0dHJpYnV0ZShcImRhdGEtaWRtdS1pZ25vcmVcIilcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdHRoaXMuaWRtdS5sb2FkVUlQSSgpXG5cdFx0XHRcdFx0YXdhaXQgdGhpcy4jbG9hZE5leHRQYWdlKClcblx0XHRcdFx0XHRpZiAodGhpcy5fdW5zZW50Q291bnQgPiAwIHx8IHRoaXMuX2Fib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkgYnJlYWtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBBYm9ydGVkLiAke3RoaXMuX3Vuc2VudENvdW50fSBtZXNzYWdlKHMpIHVuc2VudC5gKVxuXHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IGFib3J0ZWRcIilcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBEb25lLiAke3RoaXMuX3Vuc2VudENvdW50fSBtZXNzYWdlKHMpIHVuc2VudC5gKVxuXHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IGRvbmVcIilcblx0XHRcdH1cblx0XHR9IGNhdGNoIChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBFcnJvcmVkLiAke3RoaXMuX3Vuc2VudENvdW50fSBtZXNzYWdlKHMpIHVuc2VudC5gKVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneSBlcnJvcmVkXCIpXG5cdFx0fVxuXHRcdHRoaXMuX3J1bm5pbmcgPSBmYWxzZVxuXHR9XG5cblx0LyoqXG5cdCAqIFRyaWVzIHRvIGxvYWQgdGhlIHRocmVhZCBuZXh0IHBhZ2UuXG5cdCAqIElmIGxvYWRNb3JlTWVzc2FnZXMgcmV0dXJucyB0cnVlIChubyBtb3JlIHBhZ2VzKSwgbW92ZXMgdG8gdW5zZW5kaW5nLlxuXHQgKi9cblx0YXN5bmMgI2xvYWROZXh0UGFnZSgpIHtcblx0XHRpZiAodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiYWJvcnRDb250cm9sbGVyIGludGVydXB0ZWQgdGhlIGxvYWRpbmcgb2YgbmV4dCBwYWdlOiBzdG9wcGluZy4uLlwiKVxuXHRcdFx0cmV0dXJuXG5cdFx0fVxuXHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KFwiTG9hZGluZyBuZXh0IHBhZ2UuLi5cIilcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZG9uZSA9IGF3YWl0IHRoaXMuaWRtdS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSh0aGlzLl9hYm9ydENvbnRyb2xsZXIpXG5cdFx0XHRpZiAodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkID09PSBmYWxzZSkge1xuXHRcdFx0XHRpZiAoZG9uZSkge1xuXHRcdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBBbGwgcGFnZXMgbG9hZGVkICgke3RoaXMuX3BhZ2VzTG9hZGVkQ291bnR9IGluIHRvdGFsKS4gVW5zZW5kaW5nLi4uYClcblx0XHRcdFx0XHR0aGlzLl9hbGxQYWdlc0xvYWRlZCA9IHRydWVcblx0XHRcdFx0XHRhd2FpdCB0aGlzLiN1bnNlbmROZXh0TWVzc2FnZSgpXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fcGFnZXNMb2FkZWRDb3VudCsrXG5cdFx0XHRcdFx0YXdhaXQgdGhpcy4jbG9hZE5leHRQYWdlKClcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhcImFib3J0Q29udHJvbGxlciBpbnRlcnVwdGVkIHRoZSBsb2FkaW5nIG9mIG5leHQgcGFnZTogc3RvcHBpbmcuLi5cIilcblx0XHRcdH1cblx0XHR9IGNhdGNoIChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogVW5zZW5kIGZpcnN0IG1lc3NhZ2UgaW4gdmlld3BvcnQuXG5cdCAqIFVzZXMgYWRhcHRpdmUgZGVsYXlzOiBmYXN0IGJhc2VsaW5lICgxLTJzKSB3aXRoIGV4cG9uZW50aWFsIGJhY2tvZmYgb24gcmF0ZSBsaW1pdCBkZXRlY3Rpb24uXG5cdCAqL1xuXHRhc3luYyAjdW5zZW5kTmV4dE1lc3NhZ2UoKSB7XG5cdFx0aWYgKHRoaXMuX2Fib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcImFib3J0Q29udHJvbGxlciBpbnRlcnVwdGVkIHRoZSB1bnNlbmRpbmcgb2YgbmV4dCBtZXNzYWdlOiBzdG9wcGluZy4uLlwiKVxuXHRcdFx0cmV0dXJuXG5cdFx0fVxuXHRcdGlmICh0aGlzLl9jb25zZWN1dGl2ZUZhaWx1cmVzID49IDUpIHtcblx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBTdG9wcGVkOiAke3RoaXMuX2NvbnNlY3V0aXZlRmFpbHVyZXN9IGNvbnNlY3V0aXZlIGZhaWx1cmVzLiAke3RoaXMuX3Vuc2VudENvdW50fSBtZXNzYWdlKHMpIHVuc2VudC5gKVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneSBzdG9wcGluZyBkdWUgdG8gY29uc2VjdXRpdmUgZmFpbHVyZXNcIilcblx0XHRcdHJldHVyblxuXHRcdH1cblx0XHRsZXQgY2FuU2Nyb2xsID0gdHJ1ZVxuXHRcdGxldCBtc2dFbGVtZW50ID0gbnVsbFxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChgUmV0cmlldmluZyBuZXh0IG1lc3NhZ2UuLi4gKCR7dGhpcy5fdW5zZW50Q291bnR9IHVuc2VudCBzbyBmYXIpYClcblx0XHRcdGNvbnN0IHVpcGlNZXNzYWdlID0gYXdhaXQgdGhpcy5pZG11LmdldE5leHRVSVBJTWVzc2FnZSh0aGlzLl9hYm9ydENvbnRyb2xsZXIpXG5cdFx0XHRjYW5TY3JvbGwgPSB1aXBpTWVzc2FnZSAhPT0gZmFsc2Vcblx0XHRcdGlmICh1aXBpTWVzc2FnZSkge1xuXHRcdFx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChgVW5zZW5kaW5nIG1lc3NhZ2UuLi4gKCR7dGhpcy5fdW5zZW50Q291bnQgKyAxfSlgKVxuXG5cdFx0XHRcdC8vIEFkYXB0aXZlIGRlbGF5OiAxLTJzIHJhbmRvbWl6ZWQgYmFzZWxpbmUgYmV0d2VlbiB1bnNlbmRzXG5cdFx0XHRcdGlmICh0aGlzLl9sYXN0VW5zZW5kRGF0ZSAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdGNvbnN0IGVsYXBzZWQgPSBEYXRlLm5vdygpIC0gdGhpcy5fbGFzdFVuc2VuZERhdGUuZ2V0VGltZSgpXG5cdFx0XHRcdFx0Y29uc3QgbWluRGVsYXkgPSAxMDAwICsgTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMCkgLy8gMS0yc1xuXHRcdFx0XHRcdGlmIChlbGFwc2VkIDwgbWluRGVsYXkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHdhaXRNcyA9IG1pbkRlbGF5IC0gZWxhcHNlZFxuXHRcdFx0XHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoYFdhaXRpbmcgJHsod2FpdE1zIC8gMTAwMCkudG9GaXhlZCgxKX1zLi4uICgke3RoaXMuX3Vuc2VudENvdW50fSB1bnNlbnQgc28gZmFyKWApXG5cdFx0XHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgd2FpdE1zKSlcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSByZXR1cm5cblxuXHRcdFx0XHRtc2dFbGVtZW50ID0gdWlwaU1lc3NhZ2UudWlNZXNzYWdlLnJvb3Rcblx0XHRcdFx0Y29uc3QgdW5zZW50ID0gYXdhaXQgdWlwaU1lc3NhZ2UudW5zZW5kKHRoaXMuX2Fib3J0Q29udHJvbGxlcilcblxuXHRcdFx0XHRpZiAodW5zZW50KSB7XG5cdFx0XHRcdFx0Ly8gVmVyaWZ5IHRoZSBtZXNzYWdlIGFjdHVhbGx5IGRpc2FwcGVhcmVkIGZyb20gRE9NIChzZXJ2ZXIgYWNjZXB0ZWQgdGhlIG11dGF0aW9uKVxuXHRcdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCA4MDApKVxuXHRcdFx0XHRcdGNvbnN0IHN0aWxsSW5ET00gPSBtc2dFbGVtZW50LmlzQ29ubmVjdGVkICYmICFtc2dFbGVtZW50Lmhhc0F0dHJpYnV0ZShcImRhdGEtaWRtdS11bnNlbnRcIilcblx0XHRcdFx0XHRpZiAoc3RpbGxJbkRPTSkge1xuXHRcdFx0XHRcdFx0Ly8gU2VydmVyIGxpa2VseSByZWplY3RlZCDigJQgdGhlIG1lc3NhZ2UgcmVhcHBlYXJlZCBhZnRlciBvcHRpbWlzdGljIHJlbW92YWxcblx0XHRcdFx0XHRcdGNvbnNvbGUuZGVidWcoXCJEZWZhdWx0U3RyYXRlZ3k6IG1lc3NhZ2Ugc3RpbGwgaW4gRE9NIGFmdGVyIHVuc2VuZCwgcG9zc2libGUgcmF0ZSBsaW1pdFwiKVxuXHRcdFx0XHRcdFx0bXNnRWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoXCJkYXRhLWlkbXUtaWdub3JlXCIpXG5cdFx0XHRcdFx0XHR0aGlzLl9jb25zZWN1dGl2ZUZhaWx1cmVzKytcblx0XHRcdFx0XHRcdGNvbnN0IGJhY2tvZmZNcyA9IE1hdGgubWluKDYwMDAwLCA1MDAwICogTWF0aC5wb3coMiwgdGhpcy5fY29uc2VjdXRpdmVGYWlsdXJlcyAtIDEpKVxuXHRcdFx0XHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoYFJhdGUgbGltaXQgZGV0ZWN0ZWQuIEJhY2tpbmcgb2ZmICR7KGJhY2tvZmZNcyAvIDEwMDApLnRvRml4ZWQoMCl9cy4uLiAoJHt0aGlzLl91bnNlbnRDb3VudH0gdW5zZW50KWApXG5cdFx0XHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgYmFja29mZk1zKSlcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5fbGFzdFVuc2VuZERhdGUgPSBuZXcgRGF0ZSgpXG5cdFx0XHRcdFx0XHR0aGlzLl91bnNlbnRDb3VudCsrXG5cdFx0XHRcdFx0XHR0aGlzLl9jb25zZWN1dGl2ZUZhaWx1cmVzID0gMFxuXHRcdFx0XHRcdFx0Ly8gRE9NIHNocnVuayBhZnRlciByZW1vdmFsOyByZXNldCBzY3JvbGwgZm9yIGZyZXNoIHNjYW5cblx0XHRcdFx0XHRcdGlmICh0aGlzLmlkbXUudWlwaSAmJiB0aGlzLmlkbXUudWlwaS51aSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmlkbXUudWlwaS51aS5sYXN0U2Nyb2xsVG9wID0gbnVsbFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBVbnNlbmQgd29ya2Zsb3cgcmV0dXJuZWQgZmFsc2Ug4oCUIGFsbG93IHJldHJ5IG9uIG5leHQgcGFzc1xuXHRcdFx0XHRcdGNvbnNvbGUuZGVidWcoXCJEZWZhdWx0U3RyYXRlZ3k6IHVuc2VuZCByZXR1cm5lZCBmYWxzZSwgcmVtb3ZpbmcgaWdub3JlIG1hcmtlciBmb3IgcmV0cnlcIilcblx0XHRcdFx0XHRtc2dFbGVtZW50LnJlbW92ZUF0dHJpYnV0ZShcImRhdGEtaWRtdS1pZ25vcmVcIilcblx0XHRcdFx0XHR0aGlzLl9jb25zZWN1dGl2ZUZhaWx1cmVzKytcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdFx0Ly8gUmVtb3ZlIGlnbm9yZSBtYXJrZXIgc28gdGhpcyBtZXNzYWdlIGNhbiBiZSByZXRyaWVkXG5cdFx0XHRpZiAobXNnRWxlbWVudCkge1xuXHRcdFx0XHRtc2dFbGVtZW50LnJlbW92ZUF0dHJpYnV0ZShcImRhdGEtaWRtdS1pZ25vcmVcIilcblx0XHRcdH1cblx0XHRcdHRoaXMuX2NvbnNlY3V0aXZlRmFpbHVyZXMrK1xuXHRcdFx0Y29uc3QgYmFja29mZk1zID0gTWF0aC5taW4oNjAwMDAsIDMwMDAgKiBNYXRoLnBvdygyLCB0aGlzLl9jb25zZWN1dGl2ZUZhaWx1cmVzIC0gMSkpXG5cdFx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChgV29ya2Zsb3cgZmFpbGVkICgke3RoaXMuX2NvbnNlY3V0aXZlRmFpbHVyZXN9LzUpLCByZXRyeWluZyBpbiAkeyhiYWNrb2ZmTXMgLyAxMDAwKS50b0ZpeGVkKDApfXMuLi4gKCR7dGhpcy5fdW5zZW50Q291bnR9IHVuc2VudClgKVxuXHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIGJhY2tvZmZNcykpXG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGlmIChjYW5TY3JvbGwgJiYgdGhpcy5fYWJvcnRDb250cm9sbGVyICYmICF0aGlzLl9hYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy4jdW5zZW5kTmV4dE1lc3NhZ2UoKVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG59XG5cbmV4cG9ydCB7IERlZmF1bHRTdHJhdGVneSB9XG4iLCIvKiogQG1vZHVsZSBhbGVydCBBbGVydCBVSSAqL1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQWxlcnRzV3JhcHBlckVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3QgYWxlcnRzV3JhcHBlckVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LmlkID0gXCJpZG11LWFsZXJ0c1wiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnRvcCA9IFwiMjBweFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIyMHB4XCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiZ3JpZFwiXG5cdHJldHVybiBhbGVydHNXcmFwcGVyRWxlbWVudFxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHBhcmFtIHtzdHJpbmd9ICAgdGV4dFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQWxlcnRFbGVtZW50KGRvY3VtZW50LCB0ZXh0KSB7XG5cdGNvbnN0IGFsZXJ0RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0YWxlcnRFbGVtZW50LnRleHRDb250ZW50ID0gdGV4dFxuXHRyZXR1cm4gYWxlcnRFbGVtZW50XG59XG4iLCIvKiogQG1vZHVsZSBvdmVybGF5IElETVUncyBvdmVybGF5ICovXG5cbi8qKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU92ZXJsYXlFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IG92ZXJsYXlFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRvdmVybGF5RWxlbWVudC5pZCA9IFwiaWRtdS1vdmVybGF5XCJcblx0b3ZlcmxheUVsZW1lbnQudGFiSW5kZXggPSAwXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIwXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUud2lkdGggPSBcIjEwMHZ3XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gXCIxMDB2aFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnpJbmRleCA9IFwiOTk4XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjMDAwMDAwZDZcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0cmV0dXJuIG92ZXJsYXlFbGVtZW50XG59XG4iLCIvKiogQG1vZHVsZSB1aSBJRE1VJ3Mgb3duIHVpL292ZXJsYXlcbiAqIFByb3ZpZGUgYSBidXR0b24gdG8gdW5zZW5kIG1lc3NhZ2VzXG4gKi9cblxuaW1wb3J0IHsgY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQgfSBmcm9tIFwiLi9tZW51LWJ1dHRvbi5qc1wiXG5pbXBvcnQgeyBjcmVhdGVNZW51RWxlbWVudCB9IGZyb20gXCIuL21lbnUuanNcIlxuaW1wb3J0IElETVUgZnJvbSBcIi4uLy4uLy4uL2lkbXUvaWRtdS5qc1wiXG5pbXBvcnQgeyBEZWZhdWx0U3RyYXRlZ3kgfSBmcm9tIFwiLi4vLi4vLi4vdWkvZGVmYXVsdC91bnNlbmQtc3RyYXRlZ3kuanNcIlxuaW1wb3J0IHsgY3JlYXRlQWxlcnRzV3JhcHBlckVsZW1lbnQgfSBmcm9tIFwiLi9hbGVydC5qc1wiXG5pbXBvcnQgeyBjcmVhdGVPdmVybGF5RWxlbWVudCB9IGZyb20gXCIuL292ZXJsYXkuanNcIlxuaW1wb3J0IHsgQlVUVE9OX1NUWUxFIH0gZnJvbSBcIi4vc3R5bGUvaW5zdGFncmFtLmpzXCJcbi8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyAqL1xuaW1wb3J0IHsgVW5zZW5kU3RyYXRlZ3kgfSBmcm9tIFwiLi4vLi4vLi4vdWkvdW5zZW5kLXN0cmF0ZWd5LmpzXCJcblxuY2xhc3MgT1NEIHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IHJvb3Rcblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gb3ZlcmxheUVsZW1lbnRcblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gbWVudUVsZW1lbnRcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25cblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gc3RhdHVzRWxlbWVudFxuXHQgKi9cblx0Y29uc3RydWN0b3IoZG9jdW1lbnQsIHJvb3QsIG92ZXJsYXlFbGVtZW50LCBtZW51RWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIHN0YXR1c0VsZW1lbnQpIHtcblx0XHR0aGlzLl9kb2N1bWVudCA9IGRvY3VtZW50XG5cdFx0dGhpcy5fcm9vdCA9IHJvb3Rcblx0XHR0aGlzLl9vdmVybGF5RWxlbWVudCA9IG92ZXJsYXlFbGVtZW50XG5cdFx0dGhpcy5fbWVudUVsZW1lbnQgPSBtZW51RWxlbWVudFxuXHRcdHRoaXMuX3N0YXR1c0VsZW1lbnQgPSBzdGF0dXNFbGVtZW50XG5cdFx0dGhpcy5fdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24gPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvblxuXHRcdHRoaXMuX2lkbXUgPSBuZXcgSURNVSh0aGlzLndpbmRvdywgdGhpcy5vblN0YXR1c1RleHQuYmluZCh0aGlzKSlcblx0XHR0aGlzLl9zdHJhdGVneSA9IG5ldyBEZWZhdWx0U3RyYXRlZ3kodGhpcy5faWRtdSkgLy8gVE9ETyBtb3ZlIG91dFxuXHRcdHRoaXMuX3N0b3BSZXF1ZXN0ZWQgPSBmYWxzZVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7d2luZG93fSB3aW5kb3dcblx0ICogQHJldHVybnMge09TRH1cblx0ICovXG5cdHN0YXRpYyByZW5kZXIod2luZG93KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcInJlbmRlclwiKVxuXHRcdGNvbnN0IHVpID0gT1NELmNyZWF0ZSh3aW5kb3cuZG9jdW1lbnQpXG5cdFx0d2luZG93LmRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodWkucm9vdClcblx0XHRyZXR1cm4gdWlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0gICB7RG9jdW1lbnR9IGRvY3VtZW50XG5cdCAqIEByZXR1cm5zIHtPU0R9XG5cdCAqL1xuXHRzdGF0aWMgY3JlYXRlKGRvY3VtZW50KSB7XG5cdFx0Y29uc3Qgcm9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0XHRyb290LmlkID0gXCJpZG11LXJvb3RcIlxuXHRcdGNvbnN0IG1lbnVFbGVtZW50ID0gY3JlYXRlTWVudUVsZW1lbnQoZG9jdW1lbnQpXG5cdFx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBjcmVhdGVPdmVybGF5RWxlbWVudChkb2N1bWVudClcblx0XHRjb25zdCBhbGVydHNXcmFwcGVyRWxlbWVudCA9IGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50KGRvY3VtZW50KVxuXHRcdGNvbnN0IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uID0gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIFwiVW5zZW5kIGFsbCBETXNcIiwgQlVUVE9OX1NUWUxFLlBSSU1BUlkpXG5cdFx0Y29uc3Qgc3RhdHVzRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0XHRzdGF0dXNFbGVtZW50LnRleHRDb250ZW50ID0gXCJSZWFkeVwiXG5cdFx0c3RhdHVzRWxlbWVudC5pZCA9IFwiaWRtdS1zdGF0dXNcIlxuXHRcdHN0YXR1c0VsZW1lbnQuc3R5bGUgPSBcIndpZHRoOiAyMDBweFwiXG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChvdmVybGF5RWxlbWVudClcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGFsZXJ0c1dyYXBwZXJFbGVtZW50KVxuXHRcdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKVxuXHRcdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKHN0YXR1c0VsZW1lbnQpXG5cdFx0cm9vdC5hcHBlbmRDaGlsZChtZW51RWxlbWVudClcblx0XHRjb25zdCB1aSA9IG5ldyBPU0QoZG9jdW1lbnQsIHJvb3QsIG92ZXJsYXlFbGVtZW50LCBtZW51RWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIHN0YXR1c0VsZW1lbnQpXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGV2ZW50KSA9PiB1aS4jb25XaW5kb3dLZXlFdmVudChldmVudCkpIC8vIFRPRE8gdGVzdFxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLCAoZXZlbnQpID0+IHVpLiNvbldpbmRvd0tleUV2ZW50KGV2ZW50KSkgLy8gVE9ETyB0ZXN0XG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChldmVudCkgPT4gdWkuI29uVW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25DbGljayhldmVudCkpXG5cdFx0dWkuX211dGF0aW9uT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zKSA9PiB1aS4jb25NdXRhdGlvbnModWksIG11dGF0aW9ucykpXG5cdFx0dWkuX211dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGNoaWxkTGlzdDogdHJ1ZSB9KSAvLyBUT0RPIHRlc3Rcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhVGV4dENvbnRlbnQgPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudFxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFCYWNrZ3JvdW5kQ29sb3IgPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3Jcblx0XHRyZXR1cm4gdWlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGV4dFxuXHQgKi9cblx0b25TdGF0dXNUZXh0KHRleHQpIHtcblx0XHR0aGlzLnN0YXR1c0VsZW1lbnQudGV4dENvbnRlbnQgPSB0ZXh0XG5cdH1cblxuXHRhc3luYyAjc3RhcnRVbnNlbmRpbmcoKSB7XG5cdFx0dGhpcy5fc3RvcFJlcXVlc3RlZCA9IGZhbHNlXG5cdFx0O1suLi50aGlzLm1lbnVFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJidXR0b25cIildLmZpbHRlcihidXR0b24gPT4gYnV0dG9uICE9PSB0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKS5mb3JFYWNoKGJ1dHRvbiA9PiB7XG5cdFx0XHRidXR0b24uc3R5bGUudmlzaWJpbGl0eSA9IFwiaGlkZGVuXCJcblx0XHRcdGJ1dHRvbi5kaXNhYmxlZCA9IHRydWVcblx0XHR9KVxuXHRcdHRoaXMub3ZlcmxheUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiXCJcblx0XHR0aGlzLm92ZXJsYXlFbGVtZW50LmZvY3VzKClcblx0XHR0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnRleHRDb250ZW50ID0gXCJTdG9wIHByb2Nlc3NpbmdcIlxuXHRcdHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjRkEzODNFXCJcblx0XHR0aGlzLnN0YXR1c0VsZW1lbnQuc3R5bGUuY29sb3IgPSBcIndoaXRlXCJcblx0XHR0aGlzLl9tdXRhdGlvbk9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLnN0cmF0ZWd5LnJ1bigpXG5cdFx0fSBjYXRjaChlcnJvcikge1xuXHRcdFx0aWYodGhpcy5fc3RvcFJlcXVlc3RlZCB8fCB0aGlzLnN0cmF0ZWd5Ll9hYm9ydENvbnRyb2xsZXI/LnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdHJldHVyblxuXHRcdFx0fVxuXHRcdFx0Y29uc29sZS5lcnJvcihlcnJvcilcblx0XHRcdGlmKHRoaXMuc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdFx0dGhpcy5zdHJhdGVneS5zdG9wKClcblx0XHRcdH1cblx0XHRcdHRoaXMuc3RhdHVzRWxlbWVudC5pbm5lckhUTUwgPSBgPHNwYW4gc3R5bGU9XCJjb2xvcjogcmVkXCI+QW4gZXJyb3Igb2NjdXJlZCwgPGEgaHJlZj1cImh0dHBzOi8vZ2l0aHViLmNvbS90aG91Z2h0c3VuaWZpY2F0b3IvaW5zdGFncmFtLWRtLXVuc2VuZGVyL2lzc3Vlcy9uZXc/dGVtcGxhdGU9YnVnX3JlcG9ydC5tZFwiPnBsZWFzZSBvcGVuIGFuIGlzc3VlPC9hPjwvc3Bhbj5gXG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuI29uVW5zZW5kaW5nRmluaXNoZWQoKVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge09TRH0gdWlcblx0ICovXG5cdCNvbk11dGF0aW9ucyh1aSkge1xuXHRcdGlmKHVpLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW2lkXj1tb3VudF0gPiBkaXYgPiBkaXYgPiBkaXZcIikgIT09IG51bGwgJiYgdWkpIHtcblx0XHRcdGlmKHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIpIHtcblx0XHRcdFx0dGhpcy5fbXV0YXRpb25PYnNlcnZlci5kaXNjb25uZWN0KClcblx0XHRcdH1cblx0XHRcdHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcih1aS4jb25NdXRhdGlvbnMuYmluZCh0aGlzLCB1aSkpXG5cdFx0XHR0aGlzLl9tdXRhdGlvbk9ic2VydmVyLm9ic2VydmUodWkucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbaWRePW1vdW50XSA+IGRpdiA+IGRpdiA+IGRpdlwiKSwgeyBjaGlsZExpc3Q6IHRydWUsIGF0dHJpYnV0ZXM6IHRydWUgfSlcblx0XHR9XG5cdFx0aWYodGhpcy53aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3RhcnRzV2l0aChcIi9kaXJlY3QvdC9cIikpIHtcblx0XHRcdGlmKCF0aGlzLnN0cmF0ZWd5LmlzUnVubmluZygpKSB7XG5cdFx0XHRcdHRoaXMuc3RyYXRlZ3kucmVzZXQoKVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5yb290LnN0eWxlLmRpc3BsYXkgPSBcIlwiXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucm9vdC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0XHRcdGlmKHRoaXMuc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdFx0dGhpcy5zdHJhdGVneS5zdG9wKClcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtPU0R9IHVpXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50XG5cdCAqL1xuXHQjb25VbnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbkNsaWNrKCkge1xuXHRcdGlmKHRoaXMuc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJVc2VyIGFza2VkIGZvciBtZXNzYWdlcyB1bnNlbmRpbmcgdG8gc3RvcFwiKVxuXHRcdFx0dGhpcy5fc3RvcFJlcXVlc3RlZCA9IHRydWVcblx0XHRcdHRoaXMuc3RyYXRlZ3kuc3RvcCgpXG5cdFx0XHR0aGlzLiNvblVuc2VuZGluZ0ZpbmlzaGVkKClcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIlVzZXIgYXNrZWQgZm9yIG1lc3NhZ2VzIHVuc2VuZGluZyB0byBzdGFydDsgVUkgaW50ZXJhY3Rpb24gd2lsbCBiZSBkaXNhYmxlZCBpbiB0aGUgbWVhbnRpbWVcIilcblx0XHRcdHRoaXMuI3N0YXJ0VW5zZW5kaW5nKClcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnRcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHQjb25XaW5kb3dLZXlFdmVudChldmVudCkge1xuXHRcdGlmKHRoaXMuc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdGNvbnNvbGUubG9nKFwiVXNlciBpbnRlcmFjdGlvbiBpcyBkaXNhYmxlZCBhcyB0aGUgdW5zZW5kaW5nIGlzIHN0aWxsIHJ1bm5pbmc7IFBsZWFzZSBzdG9wIHRoZSBleGVjdXRpb24gZmlyc3QuXCIpXG5cdFx0XHRldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKVxuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcblx0XHRcdHRoaXMub3ZlcmxheUVsZW1lbnQuZm9jdXMoKVxuXHRcdFx0cmV0dXJuIGZhbHNlXG5cdFx0fVxuXHR9XG5cblx0I29uVW5zZW5kaW5nRmluaXNoZWQoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcInJlbmRlciBvblVuc2VuZGluZ0ZpbmlzaGVkXCIpXG5cdFx0O1suLi50aGlzLm1lbnVFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJidXR0b25cIildLmZpbHRlcihidXR0b24gPT4gYnV0dG9uICE9PSB0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKS5mb3JFYWNoKGJ1dHRvbiA9PiB7XG5cdFx0XHRidXR0b24uc3R5bGUudmlzaWJpbGl0eSA9IFwiXCJcblx0XHRcdGJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlXG5cdFx0fSlcblx0XHR0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnRleHRDb250ZW50ID0gdGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhVGV4dENvbnRlbnRcblx0XHR0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YUJhY2tncm91bmRDb2xvclxuXHRcdHRoaXMub3ZlcmxheUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiXG5cdFx0dGhpcy5zdGF0dXNFbGVtZW50LnN0eWxlLmNvbG9yID0gXCJcIlxuXHRcdHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLl9kb2N1bWVudC5ib2R5LCB7IGNoaWxkTGlzdDogdHJ1ZSB9KSAvLyBUT0RPIHRlc3Rcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0RvY3VtZW50fVxuXHQgKi9cblx0Z2V0IGRvY3VtZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl9kb2N1bWVudFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7V2luZG93fVxuXHQgKi9cblx0Z2V0IHdpbmRvdygpIHtcblx0XHRyZXR1cm4gdGhpcy5fZG9jdW1lbnQuZGVmYXVsdFZpZXdcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxEaXZFbGVtZW50fVxuXHQgKi9cblx0Z2V0IHJvb3QoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Jvb3Rcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxEaXZFbGVtZW50fVxuXHQgKi9cblx0Z2V0IG92ZXJsYXlFbGVtZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl9vdmVybGF5RWxlbWVudFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTERpdkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgbWVudUVsZW1lbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21lbnVFbGVtZW50XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MQnV0dG9uRWxlbWVudH1cblx0ICovXG5cdGdldCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25cblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxEaXZFbGVtZW50fVxuXHQgKi9cblx0Z2V0IHN0YXR1c0VsZW1lbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0YXR1c0VsZW1lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge1Vuc2VuZFN0cmF0ZWd5fVxuXHQgKi9cblx0Z2V0IHN0cmF0ZWd5KCkgeyAvLyBUT0RPIG1vdmUgb3V0XG5cdFx0cmV0dXJuIHRoaXMuX3N0cmF0ZWd5XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtJRE1VfVxuXHQgKi9cblx0Z2V0IGlkbXUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2lkbXVcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE9TRFxuIiwiLyoqIEBtb2R1bGUgbWFpbiBNYWluIG1vZHVsZSAqL1xuXG5pbXBvcnQgT1NEIGZyb20gXCIuL29zZC9vc2QuanNcIlxuXG4vKipcbiAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1haW4od2luZG93KSB7XG5cdE9TRC5yZW5kZXIod2luZG93KVxufVxuXG5pZih0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiKSB7XG5cdG1haW4od2luZG93KVxufVxuIl0sIm5hbWVzIjpbInN0cmluZ3MuTEFCRUxfUEFUVEVSTlMiLCJzdHJpbmdzLlVOU0VORF9URVhUX1ZBUklBTlRTIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBQUE7QUFDQTtDQUNPLE1BQU0sWUFBWSxHQUFHO0NBQzVCLENBQUMsU0FBUyxFQUFFLFNBQVM7Q0FDckIsQ0FBQyxXQUFXLEVBQUUsV0FBVztDQUN6QixFQUFDO0FBQ0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsU0FBUyxFQUFFO0NBQzNELENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsNkJBQTRCO0NBQzVELENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBTztDQUNwQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQUs7Q0FDbkMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFlBQVksR0FBRyxNQUFLO0NBQ3pDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBSztDQUNwQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE9BQU07Q0FDeEMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxVQUFTO0NBQ3ZDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsK0JBQThCO0NBQ2hFLENBQUMsR0FBRyxTQUFTLEVBQUU7Q0FDZixFQUFFLGFBQWEsQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLENBQUMsYUFBYSxFQUFFLFNBQVMsQ0FBQyxTQUFTLEVBQUM7Q0FDNUUsRUFBRTtDQUNGOztDQ3hCQTtBQUNBO0FBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUU7Q0FDbkUsQ0FBQyxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBQztDQUN2RCxDQUFDLGFBQWEsQ0FBQyxXQUFXLEdBQUcsS0FBSTtDQUNqQyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUM7Q0FDM0MsQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLE1BQU07Q0FDbkQsRUFBRSxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLGdCQUFnQixFQUFDO0NBQ2pELEVBQUUsRUFBQztDQUNILENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsRUFBRSxNQUFNO0NBQ2xELEVBQUUsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFDO0NBQ2pDLEVBQUUsRUFBQztDQUNILENBQUMsT0FBTyxhQUFhO0NBQ3JCOztDQ3RCQTtBQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLGlCQUFpQixDQUFDLFFBQVEsRUFBRTtDQUM1QyxDQUFDLE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFDO0NBQ2xELENBQUMsV0FBVyxDQUFDLEVBQUUsR0FBRyxZQUFXO0NBQzdCLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsT0FBTTtDQUMvQixDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLFFBQU87Q0FDbEMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxRQUFPO0NBQ3JDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBRztDQUMvQixDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU07Q0FDbkMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxPQUFNO0NBQy9CLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsU0FBUTtDQUN4QyxDQUFDLE9BQU8sV0FBVztDQUNuQjs7Q0NqQkE7QUFDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7QUFDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLGNBQWMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRTtDQUNwRSxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFLO0NBQ3pDLEVBQUUsSUFBSSxpQkFBZ0I7Q0FDdEIsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNO0NBQzdCLEdBQUcsR0FBRyxnQkFBZ0IsRUFBRTtDQUN4QixJQUFJLGdCQUFnQixDQUFDLFVBQVUsR0FBRTtDQUNqQyxJQUFJO0NBQ0osR0FBRyxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyx3QkFBd0IsRUFBRSxlQUFlLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBQztDQUNoRixJQUFHO0NBQ0gsRUFBRSxlQUFlLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDaEUsRUFBRSxJQUFJLE9BQU8sR0FBRyxVQUFVLEdBQUU7Q0FDNUIsRUFBRSxHQUFHLE9BQU8sRUFBRTtDQUNkLEdBQUcsT0FBTyxDQUFDLE9BQU8sRUFBQztDQUNuQixHQUFHLGVBQWUsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBQztDQUNwRSxHQUFHLE1BQU07Q0FDVCxHQUFHLGdCQUFnQixHQUFHLElBQUksZ0JBQWdCLENBQUMsQ0FBQyxTQUFTLEVBQUUsUUFBUSxLQUFLO0NBQ3BFLElBQUksT0FBTyxHQUFHLFVBQVUsQ0FBQyxTQUFTLEVBQUM7Q0FDbkMsSUFBSSxHQUFHLE9BQU8sRUFBRTtDQUNoQixLQUFLLFFBQVEsQ0FBQyxVQUFVLEdBQUU7Q0FDMUIsS0FBSyxPQUFPLENBQUMsT0FBTyxFQUFDO0NBQ3JCLEtBQUssZUFBZSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQ3RFLEtBQUs7Q0FDTCxJQUFJLEVBQUM7Q0FDTCxHQUFHLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsRUFBQztDQUN2RSxHQUFHO0NBQ0gsRUFBRSxDQUFDO0NBQ0gsQ0FBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLHNCQUFzQixDQUFDLFdBQVcsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRTtDQUN6RixDQUFDLE1BQU0sT0FBTyxHQUFHLGNBQWMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBQztDQUNwRSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEdBQUU7Q0FDcEIsQ0FBQyxPQUFPLFVBQVUsRUFBRSxJQUFJLE9BQU87Q0FDL0I7O0NDdEVBO0FBQ0E7QUFFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsTUFBTSxXQUFXLENBQUM7Q0FDbEI7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsRUFBRSxFQUFFO0NBQ2xDLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFJO0NBQ2xCLEVBQUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxXQUFVO0NBQzlCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUU7Q0FDckQsRUFBRSxPQUFPLFVBQVUsRUFBRSxJQUFJLGNBQWMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLGVBQWUsQ0FBQztDQUM1RSxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxzQkFBc0IsQ0FBQyxXQUFXLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUU7Q0FDMUUsRUFBRSxPQUFPLHNCQUFzQixDQUFDLFdBQVcsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLGVBQWUsQ0FBQztDQUNqRixFQUFFO0FBQ0Y7Q0FDQTs7Q0NyQ0E7Q0FDQSxNQUFNLG9CQUFvQixHQUFHO0NBQzdCLENBQUMsUUFBUTtDQUNULENBQUMsZUFBZTtDQUNoQixDQUFDLFNBQVM7Q0FDVixDQUFDLFVBQVU7Q0FDWCxDQUFDLFNBQVM7Q0FDVixDQUFDLGNBQWM7Q0FDZixFQUFDO0FBQ0Q7QUFDQTtDQUNBO0NBQ0EsTUFBTSxjQUFjLEdBQUc7Q0FDdkIsQ0FBQyw4Q0FBOEM7Q0FDL0MsQ0FBQyw4QkFBOEI7Q0FDL0IsQ0FBQyxzQkFBc0I7Q0FDdkIsQ0FBQywrQkFBK0I7Q0FDaEMsQ0FBQyx5QkFBeUI7Q0FDMUIsQ0FBQywwQkFBMEI7Q0FDM0IsQ0FBQyx5QkFBeUI7Q0FDMUI7O0NDekJBO0FBQ0E7QUFJQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLFNBQVMsZUFBZSxDQUFDLE1BQU0sRUFBRTtDQUNqQyxDQUFDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxxQkFBcUIsR0FBRTtDQUM1QyxDQUFDLE1BQU0sSUFBSSxHQUFHO0NBQ2QsRUFBRSxPQUFPLEVBQUUsSUFBSTtDQUNmLEVBQUUsVUFBVSxFQUFFLElBQUk7Q0FDbEIsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUM7Q0FDbEMsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUM7Q0FDbkMsRUFBRSxTQUFTLEVBQUUsQ0FBQztDQUNkLEVBQUUsV0FBVyxFQUFFLE9BQU87Q0FDdEIsR0FBRTtDQUNGLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFlBQVksQ0FBQyxjQUFjLEVBQUUsRUFBRSxHQUFHLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBQztDQUNwRixDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxZQUFZLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxFQUFDO0NBQzVELENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFlBQVksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLEVBQUM7Q0FDNUQsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLFlBQVksRUFBRSxFQUFFLEdBQUcsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFDO0NBQ2hGLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLEVBQUM7Q0FDeEQsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsRUFBQztDQUN4RCxDQUFDO0FBQ0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsU0FBUyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUU7Q0FDbEMsQ0FBQyxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMscUJBQXFCLEdBQUU7Q0FDNUMsQ0FBQyxNQUFNLElBQUksR0FBRztDQUNkLEVBQUUsT0FBTyxFQUFFLElBQUk7Q0FDZixFQUFFLFVBQVUsRUFBRSxJQUFJO0NBQ2xCLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDO0NBQ2xDLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDO0NBQ25DLEVBQUUsU0FBUyxFQUFFLENBQUM7Q0FDZCxFQUFFLFdBQVcsRUFBRSxPQUFPO0NBQ3RCLEdBQUU7Q0FDRixDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxZQUFZLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxFQUFDO0NBQzNELENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFlBQVksQ0FBQyxjQUFjLEVBQUUsRUFBRSxHQUFHLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBQztDQUNwRixDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxFQUFDO0NBQ3ZELENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxZQUFZLEVBQUUsRUFBRSxHQUFHLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBQztDQUNoRixDQUFDO0FBQ0Q7Q0FDQSxNQUFNLFNBQVMsU0FBUyxXQUFXLENBQUM7QUFDcEM7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLHFCQUFxQixHQUFHO0NBQ3pCLEVBQUUsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFhO0NBQ3JDO0NBQ0EsRUFBRSxNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsYUFBYSxDQUFDLGVBQWUsRUFBQztDQUN4RCxFQUFFLElBQUksV0FBVyxFQUFFO0NBQ25CLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsRUFBQztDQUMzQyxHQUFHLE1BQU0sUUFBUSxHQUFHLFdBQVcsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFDO0NBQ3ZELEdBQUcsSUFBSSxRQUFRLEVBQUUsUUFBUSxDQUFDLEtBQUssR0FBRTtDQUNqQyxHQUFHO0NBQ0g7Q0FDQSxFQUFFLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxhQUFhLENBQUMsNkJBQTZCLEVBQUM7Q0FDckUsRUFBRSxJQUFJLFVBQVUsRUFBRTtDQUNsQixHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0NBQWtDLEVBQUM7Q0FDcEQsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLGFBQWEsQ0FBQyxTQUFTLEVBQUUsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFDO0NBQ3pGLEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLEVBQUU7Q0FDMUIsRUFBRSxLQUFLLE1BQU0sR0FBRyxJQUFJQSxjQUFzQixFQUFFO0NBQzVDLEdBQUcsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDLGFBQWEsQ0FBQyxHQUFHLEVBQUM7Q0FDdEMsR0FBRyxJQUFJLEVBQUUsRUFBRTtDQUNYO0NBQ0EsSUFBSSxNQUFNLEdBQUcsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFDO0NBQ25FLElBQUksSUFBSSxHQUFHLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxPQUFPLEdBQUc7Q0FDOUM7Q0FDQSxJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sS0FBSyxRQUFRLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsS0FBSyxRQUFRLEVBQUUsT0FBTyxFQUFFO0NBQ2xGLElBQUk7Q0FDSixHQUFHO0FBQ0g7Q0FDQTtDQUNBLEVBQUUsT0FBTyxLQUFLLENBQUMsYUFBYSxDQUFDLG1DQUFtQyxDQUFDO0NBQ2pFLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLHFCQUFxQixDQUFDLGVBQWUsRUFBRTtDQUM5QyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMseUNBQXlDLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBQztDQUNyRSxFQUFFLElBQUksQ0FBQyxxQkFBcUIsR0FBRTtBQUM5QjtDQUNBO0NBQ0E7Q0FDQSxFQUFFLE1BQU0sWUFBWSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztDQUNsQyxFQUFFLE1BQU0sY0FBYyxHQUFHLENBQUMsRUFBRSxFQUFFLEtBQUssS0FBSztDQUN4QyxHQUFHLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRSxNQUFNO0NBQ3hCLEdBQUcsS0FBSyxNQUFNLEtBQUssSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ3BDLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUM7Q0FDNUIsSUFBSSxjQUFjLENBQUMsS0FBSyxFQUFFLEtBQUssR0FBRyxDQUFDLEVBQUM7Q0FDcEMsSUFBSTtDQUNKLElBQUc7Q0FDSCxFQUFFLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBQztBQUM5QjtDQUNBO0NBQ0EsRUFBRSxLQUFLLElBQUksT0FBTyxHQUFHLENBQUMsRUFBRSxPQUFPLEdBQUcsQ0FBQyxFQUFFLE9BQU8sRUFBRSxFQUFFO0NBQ2hELEdBQUcsSUFBSSxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxPQUFPLElBQUk7QUFDbEQ7Q0FDQSxHQUFHLEtBQUssTUFBTSxNQUFNLElBQUksWUFBWSxFQUFFO0NBQ3RDLElBQUksZUFBZSxDQUFDLE1BQU0sRUFBQztDQUMzQixJQUFJO0FBQ0o7Q0FDQSxHQUFHLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUM7QUFDekQ7Q0FDQSxHQUFHLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0NBQ2hELEdBQUcsSUFBSSxHQUFHLEVBQUU7Q0FDWixJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0RBQWtELEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBQztDQUNuRixJQUFJLE9BQU8sR0FBRztDQUNkLElBQUk7QUFDSjtDQUNBLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQywyQkFBMkIsRUFBRSxPQUFPLEVBQUUsOEJBQThCLEVBQUM7Q0FDdEYsR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0NBQzlCLEdBQUcsTUFBTSxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsRUFBQztDQUN4RCxHQUFHO0FBQ0g7Q0FDQTtDQUNBLEVBQUUsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLGVBQWUsR0FBRTtDQUNuRCxFQUFFLElBQUksZUFBYztDQUNwQixFQUFFLE1BQU0sWUFBWSxHQUFHLE1BQU07Q0FDN0IsR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsOERBQThELEVBQUM7Q0FDNUYsR0FBRyxZQUFZLENBQUMsY0FBYyxFQUFDO0NBQy9CLElBQUc7Q0FDSCxFQUFFLGVBQWUsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBQztBQUNoRTtDQUNBLEVBQUUsS0FBSyxNQUFNLE1BQU0sSUFBSSxZQUFZLEVBQUU7Q0FDckMsR0FBRyxlQUFlLENBQUMsTUFBTSxFQUFDO0NBQzFCLEdBQUc7QUFDSDtDQUNBLEVBQUUsSUFBSTtDQUNOLEdBQUcsTUFBTSxZQUFZLEdBQUcsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDO0NBQzNDLElBQUksSUFBSSxDQUFDLGNBQWM7Q0FDdkIsS0FBSyxJQUFJLENBQUMsSUFBSTtDQUNkLEtBQUssTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztDQUM1QyxLQUFLLG1CQUFtQjtDQUN4QixLQUFLO0NBQ0wsSUFBSSxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEtBQUs7Q0FDckMsS0FBSyxjQUFjLEdBQUcsVUFBVSxDQUFDLE1BQU0sTUFBTSxDQUFDLCtCQUErQixDQUFDLEVBQUUsSUFBSSxFQUFDO0NBQ3JGLEtBQUssQ0FBQztDQUNOLElBQUksRUFBQztBQUNMO0NBQ0EsR0FBRyxJQUFJLFlBQVksRUFBRTtDQUNyQixJQUFJLE9BQU8sWUFBWTtDQUN2QixJQUFJO0NBQ0osR0FBRyxPQUFPLFlBQVk7Q0FDdEIsR0FBRyxTQUFTO0NBQ1osR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLEdBQUU7Q0FDOUIsR0FBRyxZQUFZLENBQUMsY0FBYyxFQUFDO0NBQy9CLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQ3BFLEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxvQkFBb0IsQ0FBQyxlQUFlLEVBQUU7Q0FDN0MsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHNCQUFzQixFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUM7Q0FDbEQsRUFBRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0FBQzdCO0NBQ0EsRUFBRSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLEVBQUM7Q0FDdkQsRUFBRSxJQUFJLE1BQU0sRUFBRTtDQUNkLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxFQUFDO0NBQzNCLEdBQUc7QUFDSDtDQUNBLEVBQUUsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLGVBQWUsR0FBRTtDQUNuRCxFQUFFLElBQUksZUFBYztDQUNwQixFQUFFLElBQUksZUFBYztDQUNwQixFQUFFLE1BQU0sWUFBWSxHQUFHLE1BQU07Q0FDN0IsR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsNkRBQTZELEVBQUM7Q0FDM0YsR0FBRyxZQUFZLENBQUMsY0FBYyxFQUFDO0NBQy9CLEdBQUcsSUFBSSxjQUFjLEVBQUU7Q0FDdkIsSUFBSSxjQUFjLEdBQUU7Q0FDcEIsSUFBSTtDQUNKLElBQUc7Q0FDSCxFQUFFLGVBQWUsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBQztBQUNoRTtDQUNBLEVBQUUsSUFBSTtDQUNOLEdBQUcsTUFBTSxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDO0NBQ3JDLElBQUksSUFBSSxDQUFDLGNBQWM7Q0FDdkIsS0FBSyxJQUFJLENBQUMsSUFBSTtDQUNkLEtBQUssTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUk7Q0FDckQsS0FBSyxtQkFBbUI7Q0FDeEIsS0FBSztDQUNMLElBQUksSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFLO0NBQ3JDLEtBQUssY0FBYyxHQUFHLFFBQU87Q0FDN0IsS0FBSyxjQUFjLEdBQUcsVUFBVSxDQUFDLE1BQU0sTUFBTSxDQUFDLDhCQUE4QixDQUFDLEVBQUUsR0FBRyxFQUFDO0NBQ25GLEtBQUssQ0FBQztDQUNOLElBQUksRUFBQztDQUNMLEdBQUcsT0FBTyxNQUFNO0NBQ2hCLEdBQUcsU0FBUztDQUNaLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxHQUFFO0NBQzlCLEdBQUcsWUFBWSxDQUFDLGNBQWMsRUFBQztDQUMvQixHQUFHLGVBQWUsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBQztDQUNwRSxHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sZUFBZSxDQUFDLFlBQVksRUFBRSxlQUFlLEVBQUU7Q0FDdEQsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLG9GQUFvRixFQUFFLFlBQVksRUFBQztDQUNuSCxFQUFFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxlQUFlLEdBQUU7Q0FDbkQsRUFBRSxJQUFJLGVBQWM7Q0FFcEIsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNO0NBQzdCLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxDQUFDLHdEQUF3RCxFQUFDO0NBQ3RGLEdBQUcsWUFBWSxDQUFDLGNBQWMsRUFBQztDQUkvQixJQUFHO0NBQ0gsRUFBRSxlQUFlLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7QUFDaEU7Q0FDQTtDQUNBLEVBQUUsTUFBTSxZQUFZLEdBQUcsQ0FBQyxJQUFJLEtBQUs7Q0FDakMsR0FBRyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsaUJBQWlCLEdBQUU7Q0FDckQsR0FBRyxPQUFPQyxvQkFBNEIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLFVBQVUsS0FBSyxDQUFDLENBQUM7Q0FDbEUsSUFBRztBQUNIO0NBQ0EsRUFBRSxJQUFJO0NBQ04sR0FBRyxNQUFNLFlBQVksR0FBRyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUM7Q0FDM0MsSUFBSSxJQUFJLENBQUMsc0JBQXNCO0NBQy9CLEtBQUssWUFBWTtDQUNqQixLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUk7Q0FDakMsS0FBSyxDQUFDLFNBQVMsS0FBSztDQUNwQixNQUFNLElBQUksU0FBUyxFQUFFO0NBQ3JCLE9BQU8sTUFBTSxVQUFVLEdBQUcsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxDQUFDLEVBQUM7Q0FDN0gsT0FBTyxLQUFLLE1BQU0sU0FBUyxJQUFJLFVBQVUsRUFBRTtDQUMzQyxRQUFRLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxRQUFRLEtBQUssQ0FBQyxFQUFDO0NBQ2hKLFFBQVEsSUFBSSxJQUFJLEVBQUU7Q0FDbEIsU0FBUyxPQUFPLENBQUMsS0FBSyxDQUFDLGtEQUFrRCxFQUFFLElBQUksRUFBQztDQUNoRixTQUFTLE9BQU8sSUFBSTtDQUNwQixTQUFTO0NBQ1QsUUFBUTtDQUNSLE9BQU87Q0FDUDtDQUNBLE1BQU0sTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsOEVBQThFLEVBQUM7Q0FDL0ksTUFBTSxLQUFLLE1BQU0sSUFBSSxJQUFJLFFBQVEsRUFBRTtDQUNuQyxPQUFPLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLFFBQVEsS0FBSyxDQUFDLEVBQUU7Q0FDOUUsUUFBUSxPQUFPLENBQUMsS0FBSyxDQUFDLHVEQUF1RCxFQUFFLElBQUksRUFBQztDQUNwRixRQUFRLE9BQU8sSUFBSTtDQUNuQixRQUFRO0NBQ1IsT0FBTztDQUNQLE1BQU07Q0FDTixLQUFLLG1CQUFtQjtDQUN4QixLQUFLO0NBQ0wsSUFBSSxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEtBQUs7Q0FDckMsS0FBSyxjQUFjLEdBQUcsVUFBVSxDQUFDLE1BQU0sTUFBTSxDQUFDLHlCQUF5QixDQUFDLEVBQUUsSUFBSSxFQUFDO0NBQy9FLEtBQUssQ0FBQztDQUNOLElBQUksRUFBQztBQUNMO0NBQ0EsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLHNDQUFzQyxFQUFFLFlBQVksRUFBQztDQUN0RSxHQUFHLE9BQU8sWUFBWTtDQUN0QixHQUFHLFNBQVM7Q0FDWixHQUFHLG1CQUFtQixDQUFDLEtBQUssR0FBRTtDQUM5QixHQUFHLFlBQVksQ0FBQyxjQUFjLEVBQUM7Q0FDL0IsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDcEUsR0FBRztDQUNILEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sZ0JBQWdCLENBQUMsWUFBWSxFQUFFLGtCQUFrQixFQUFFLGVBQWUsRUFBRTtDQUMzRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0JBQWtCLEVBQUM7Q0FDbkMsRUFBRSxNQUFNLG1CQUFtQixHQUFHLElBQUksZUFBZSxHQUFFO0NBQ25ELEVBQUUsSUFBSSxlQUFjO0NBRXBCLEVBQUUsTUFBTSxZQUFZLEdBQUcsTUFBTTtDQUM3QixHQUFHLG1CQUFtQixDQUFDLEtBQUssQ0FBQyx5REFBeUQsRUFBQztDQUN2RixHQUFHLFlBQVksQ0FBQyxjQUFjLEVBQUM7Q0FJL0IsSUFBRztDQUNILEVBQUUsZUFBZSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0FBQ2hFO0NBQ0EsRUFBRSxJQUFJO0NBQ04sR0FBRyxNQUFNLE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUM7Q0FDckMsSUFBSSxJQUFJLENBQUMsc0JBQXNCO0NBQy9CLEtBQUssWUFBWTtDQUNqQixLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUk7Q0FDakMsS0FBSyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsa0JBQWtCLENBQUMsS0FBSyxLQUFLO0NBQzlFLEtBQUssZUFBZTtDQUNwQixLQUFLO0NBQ0wsSUFBSSxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEtBQUs7Q0FDckMsS0FBSyxjQUFjLEdBQUcsVUFBVSxDQUFDLE1BQU0sTUFBTSxDQUFDLDBCQUEwQixDQUFDLEVBQUUsR0FBRyxFQUFDO0NBQy9FLEtBQUssQ0FBQztDQUNOLElBQUksRUFBQztDQUNMLEdBQUcsT0FBTyxNQUFNLEtBQUssSUFBSTtDQUN6QixHQUFHLFNBQVM7Q0FDWixHQUFHLG1CQUFtQixDQUFDLEtBQUssR0FBRTtDQUM5QixHQUFHLFlBQVksQ0FBQyxjQUFjLEVBQUM7Q0FDL0IsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDcEUsR0FBRztDQUNILEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxzQkFBc0IsQ0FBQyxZQUFZLEVBQUUsZUFBZSxFQUFFO0NBQ3ZELEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyw2RUFBNkUsRUFBQztDQUM5RixFQUFFLE9BQU8sSUFBSSxDQUFDLHNCQUFzQjtDQUNwQyxHQUFHLFlBQVk7Q0FDZixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUk7Q0FDL0IsR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxzQkFBc0IsQ0FBQztDQUN0RSxHQUFHLGVBQWU7Q0FDbEIsR0FBRztDQUNILEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLGFBQWEsQ0FBQyxZQUFZLEVBQUUsZUFBZSxFQUFFO0NBQ3BELEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxxQ0FBcUMsRUFBRSxZQUFZLEVBQUM7Q0FDcEUsRUFBRSxNQUFNLElBQUksQ0FBQyxzQkFBc0I7Q0FDbkMsR0FBRyxZQUFZO0NBQ2YsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJO0NBQy9CLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsc0JBQXNCLENBQUMsS0FBSyxJQUFJO0NBQy9FLEdBQUcsZUFBZTtDQUNsQixJQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7O0NDM1dBO0FBQ0E7QUFHQTtDQUNBLE1BQU0sdUJBQXVCLFNBQVMsS0FBSyxDQUFDLEVBQUU7QUFDOUM7Q0FDQSxNQUFNLFdBQVcsQ0FBQztBQUNsQjtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRTtDQUN4QixFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBUztDQUM3QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxNQUFNLENBQUMsZUFBZSxFQUFFO0NBQy9CLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsRUFBQztDQUNyQyxFQUFFLElBQUksYUFBWTtDQUNsQixFQUFFLElBQUksYUFBWTtDQUNsQixFQUFFLElBQUk7Q0FDTixHQUFHLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsZUFBZSxFQUFDO0NBQzdFLEdBQUcsWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLGVBQWUsRUFBQztDQUNyRixHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsY0FBYyxFQUFFLFlBQVksRUFBQztDQUM5QyxHQUFHLE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxzQkFBc0IsQ0FBQyxZQUFZLEVBQUUsZUFBZSxFQUFDO0NBQ2xHLEdBQUcsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsZUFBZSxFQUFDO0NBQ3BFLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGtCQUFrQixFQUFFLEVBQUUsRUFBQztDQUMzRCxHQUFHLE9BQU8sSUFBSTtDQUNkLEdBQUcsQ0FBQyxNQUFNLEVBQUUsRUFBRTtDQUNkLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUM7Q0FDcEIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxFQUFDO0NBQzNEO0NBQ0EsR0FBRyxJQUFJO0NBQ1AsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxjQUFhO0NBQ2pELElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxhQUFhLENBQUMsU0FBUyxFQUFFLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBQztDQUMxRixJQUFJLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUM7Q0FDMUQ7Q0FDQSxJQUFJLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsRUFBRTtDQUM1QyxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksYUFBYSxDQUFDLFNBQVMsRUFBRSxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7Q0FDM0YsS0FBSyxNQUFNLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxFQUFDO0NBQzNELEtBQUs7Q0FDTCxJQUFJLENBQUMsT0FBTyxLQUFLLEVBQUU7Q0FDbkIsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBQztDQUN4QixJQUFJO0NBQ0osR0FBRyxNQUFNLElBQUksdUJBQXVCLENBQUMsNkNBQTZDLEVBQUUsRUFBRSxDQUFDO0NBQ3ZGLEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksU0FBUyxHQUFHO0NBQ2pCLEVBQUUsT0FBTyxJQUFJLENBQUMsVUFBVTtDQUN4QixFQUFFO0FBQ0Y7Q0FDQTs7Q0N0REE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxNQUFNLEVBQUUsU0FBUyxXQUFXLENBQUM7QUFDN0I7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxPQUFPLE1BQU0sR0FBRztDQUNqQixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxtQ0FBbUMsQ0FBQyxlQUFlLEVBQUU7Q0FDNUQsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxrQkFBa0IsR0FBRztDQUM1QixFQUFFO0FBQ0Y7Q0FDQTs7Q0NyQ0E7QUFDQTtBQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsbUJBQW1CLENBQUMsTUFBTSxFQUFFO0NBQzVDLENBQUMsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsa0NBQWtDLEVBQUM7Q0FDdkYsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFO0NBQ3BCLEVBQUUsT0FBTyxJQUFJO0NBQ2IsRUFBRTtDQUNGLENBQUMsTUFBTSxVQUFVLEdBQUcsbUJBQW1CLENBQUMsWUFBWSxFQUFFLE1BQU0sRUFBQztDQUM3RCxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUU7Q0FDbEIsRUFBRSxPQUFPLElBQUk7Q0FDYixFQUFFO0NBQ0YsQ0FBQyxPQUFPLFVBQVU7Q0FDbEIsQ0FBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLG1CQUFtQixDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUU7Q0FDcEQsQ0FBQyxLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sQ0FBQyxRQUFRLEVBQUU7Q0FDdEMsRUFBRSxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFDO0NBQzlDLEVBQUU7Q0FDRixHQUFHLENBQUMsS0FBSyxDQUFDLFNBQVMsS0FBSyxNQUFNLElBQUksS0FBSyxDQUFDLFNBQVMsS0FBSyxRQUFRO0NBQzlELEdBQUcsS0FBSyxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUMsWUFBWTtDQUMxQyxJQUFJO0NBQ0osR0FBRyxPQUFPLEtBQUs7Q0FDZixHQUFHO0NBQ0gsRUFBRSxNQUFNLEtBQUssR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFDO0NBQ2xELEVBQUUsSUFBSSxLQUFLLEVBQUU7Q0FDYixHQUFHLE9BQU8sS0FBSztDQUNmLEdBQUc7Q0FDSCxFQUFFO0NBQ0YsQ0FBQyxPQUFPLElBQUk7Q0FDWixDQUFDO0FBQ0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMseUJBQXlCLENBQUMsVUFBVSxFQUFFO0NBQ3REO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxJQUFJLEdBQUcsV0FBVTtDQUN0QixDQUFDLElBQUksU0FBUyxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsT0FBTTtBQUMzQztDQUNBLENBQUMsU0FBUyxNQUFNLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRTtDQUM1QixFQUFFLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRSxNQUFNO0NBQ3ZCLEVBQUUsS0FBSyxNQUFNLEtBQUssSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ25DLEdBQUcsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxTQUFTLEVBQUU7Q0FDMUMsSUFBSSxJQUFJLEdBQUcsTUFBSztDQUNoQixJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU07Q0FDckMsSUFBSTtDQUNKLEdBQUcsTUFBTSxDQUFDLEtBQUssRUFBRSxLQUFLLEdBQUcsQ0FBQyxFQUFDO0NBQzNCLEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxFQUFDO0NBQ3RCLENBQUMsT0FBTyxJQUFJO0NBQ1osQ0FBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRTtDQUNyRDtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sS0FBSyxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsRUFBQztDQUMxQyxDQUFDLE9BQU8sS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Q0FDMUIsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUU7Q0FDckMsRUFBRSxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxFQUFDO0NBQ3ZDLEVBQUUsSUFBSSxDQUFDLENBQUMsY0FBYyxLQUFLLFVBQVUsRUFBRTtDQUN2QyxHQUFHLE9BQU8sSUFBSTtDQUNkLEdBQUc7Q0FDSCxFQUFFLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRTtDQUNqQixHQUFHLEtBQUssTUFBTSxLQUFLLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNwQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEdBQUcsQ0FBQyxFQUFFLEVBQUM7Q0FDL0MsSUFBSTtDQUNKLEdBQUc7Q0FDSCxFQUFFO0NBQ0YsQ0FBQyxPQUFPLEtBQUs7Q0FDYixDQUFDO0FBQ0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxzQkFBc0IsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFLE1BQU0sRUFBRTtDQUN0RSxDQUFDLE1BQU0sY0FBYyxHQUFHLHlCQUF5QixDQUFDLElBQUksRUFBQztDQUN2RCxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUU7Q0FDdEIsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLGtEQUFrRCxFQUFDO0NBQ25FLEVBQUUsTUFBTTtDQUNSLEVBQUU7QUFDRjtDQUNBLENBQUMsTUFBTSxRQUFRLEdBQUcsQ0FBQyxHQUFHLGNBQWMsQ0FBQyxRQUFRLENBQUM7Q0FDOUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxJQUFJO0NBQ2YsR0FBRyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsa0JBQWtCLENBQUMsRUFBRSxPQUFPLEtBQUs7Q0FDdkQsR0FBRyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsa0JBQWtCLENBQUMsRUFBRSxPQUFPLEtBQUs7Q0FDdkQ7Q0FDQSxHQUFHLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsYUFBYSxDQUFDLHFCQUFxQixFQUFDO0NBQ3JHLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixFQUFFLE9BQU8sS0FBSztDQUN2QyxHQUFHLE9BQU8sbUJBQW1CLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQztDQUN4QyxHQUFHLEVBQUM7QUFDSjtDQUNBLENBQUMsUUFBUSxDQUFDLE9BQU8sR0FBRTtDQUNuQixDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7Q0FDMUIsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHdCQUF3QixFQUFFLFFBQVEsQ0FBQyxNQUFNLEVBQUUsb0JBQW9CLEVBQUM7Q0FDaEYsRUFBRSxNQUFNO0NBQ1IsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHFEQUFxRCxFQUFDO0NBQ3RFLEVBQUU7QUFDRjtDQUNBLENBQUMsS0FBSyxNQUFNLE9BQU8sSUFBSSxRQUFRLEVBQUU7Q0FDakMsRUFBRSxJQUFJLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFO0NBQ3RDLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyx1RUFBdUUsRUFBQztDQUN6RixHQUFHLEtBQUs7Q0FDUixHQUFHO0NBQ0gsRUFBRSxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDO0NBQ2xELEdBQUcsa0JBQWtCLEVBQUUsSUFBSTtDQUMzQixHQUFHLHFCQUFxQixFQUFFLElBQUk7Q0FDOUIsR0FBRyxlQUFlLEVBQUUsSUFBSTtDQUN4QixHQUFHLEVBQUM7Q0FDSixFQUFFLElBQUksZUFBZSxLQUFLLEtBQUssRUFBRTtDQUNqQyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsZUFBZSxFQUFDO0NBQ3BELEdBQUcsUUFBUTtDQUNYLEdBQUc7Q0FDSCxFQUFFLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxxQkFBcUIsR0FBRTtDQUM5QztDQUNBO0NBQ0E7Q0FDQSxFQUFFLElBQUksSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtDQUNyRCxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFDO0NBQ3hELEdBQUcsUUFBUTtDQUNYLEdBQUc7Q0FDSCxFQUFFLE9BQU8sQ0FBQyxZQUFZLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxFQUFDO0NBQzlDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxzQ0FBc0MsRUFBRSxPQUFPLEVBQUM7Q0FDaEUsRUFBRSxPQUFPLE9BQU87Q0FDaEIsRUFBRTtDQUNGLENBQUM7QUFDRDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLGVBQWUsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtDQUM5RCxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMseUNBQXlDLEVBQUM7Q0FDekQsQ0FBQyxNQUFNLHFCQUFxQixHQUFHLElBQUksZUFBZSxHQUFFO0NBQ3BELENBQUMsSUFBSSxrQkFBaUI7Q0FDdEIsQ0FBQyxJQUFJLGVBQWM7Q0FDbkIsQ0FBQyxNQUFNLFlBQVksR0FBRyxNQUFNO0NBQzVCLEVBQUUscUJBQXFCLENBQUMsS0FBSyxDQUFDLDBCQUEwQixFQUFDO0NBQ3pELEVBQUUsWUFBWSxDQUFDLGlCQUFpQixFQUFDO0NBQ2pDLEVBQUUsSUFBSSxjQUFjLEVBQUU7Q0FDdEIsR0FBRyxjQUFjLEdBQUU7Q0FDbkIsR0FBRztDQUNILEdBQUU7Q0FDRixDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBQztBQUMvRDtDQUNBO0NBQ0EsQ0FBQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUM7Q0FDcEUsQ0FBQyxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsYUFBYSxLQUFLLGlCQUFnQjtDQUM1RDtDQUNBLENBQUMsTUFBTSxnQkFBZ0IsR0FBRyxVQUFVO0NBQ3BDLElBQUksRUFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7Q0FDNUMsSUFBSSxFQUFDO0NBQ0w7Q0FDQSxDQUFDLE1BQU0sT0FBTyxHQUFHLE1BQU0sVUFBVTtDQUNqQyxJQUFJLElBQUksQ0FBQyxTQUFTLElBQUksZ0JBQWdCLEdBQUcsQ0FBQztDQUMxQyxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssRUFBQztBQUN4QjtDQUNBLENBQUMsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFVBQVM7Q0FDcEMsQ0FBQyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsYUFBWTtDQUN2QyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsaUJBQWdCO0FBQ2xDO0NBQ0E7Q0FDQSxDQUFDLE1BQU0saUJBQWlCLEdBQUcsTUFBTTtDQUNqQyxFQUFFLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxvQkFBb0IsRUFBQztDQUMxRCxFQUFFLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFO0NBQzFCLEdBQUcsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLHFCQUFxQixHQUFFO0NBQzNDLEdBQUcsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixHQUFFO0NBQ2hEO0NBQ0EsR0FBRyxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsR0FBRyxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxNQUFNLEdBQUcsR0FBRyxFQUFFO0NBQ3RHLElBQUksT0FBTyxHQUFHO0NBQ2QsSUFBSTtDQUNKLEdBQUc7Q0FDSCxFQUFFLE9BQU8sSUFBSTtDQUNiLEdBQUU7QUFDRjtDQUNBO0NBQ0EsQ0FBQyxNQUFNLGNBQWMsR0FBRyxVQUFVO0NBQ2xDLElBQUksWUFBWSxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQyxZQUFZLEdBQUcsRUFBRTtDQUNyRSxJQUFJLFlBQVksS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsWUFBWSxHQUFHLEdBQUU7Q0FDckUsQ0FBQyxJQUFJLGNBQWMsRUFBRTtDQUNyQixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsMERBQTBELEVBQUM7Q0FDM0UsRUFBRSxlQUFlLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDbkUsRUFBRSxPQUFPLElBQUk7Q0FDYixFQUFFO0FBQ0Y7Q0FDQTtDQUNBLENBQUMsSUFBSSxPQUFPLEVBQUUsRUFBRTtDQUNoQjtDQUNBLEVBQUUsTUFBTSxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsRUFBQztBQUN4RDtDQUNBO0NBQ0EsRUFBRSxNQUFNLE1BQU0sR0FBRyxpQkFBaUIsR0FBRTtDQUNwQyxFQUFFLElBQUksTUFBTSxFQUFFO0NBQ2QsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLG1GQUFtRixFQUFDO0NBQ3JHLEdBQUcsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDO0NBQ3RCLElBQUksY0FBYyxDQUFDLElBQUksRUFBRSxNQUFNLGlCQUFpQixFQUFFLEtBQUssSUFBSSxFQUFFLGVBQWUsQ0FBQztDQUM3RSxJQUFJLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0NBQ3JELElBQUksRUFBQztDQUNMLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQ3BFLEdBQUcsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFlBQVksR0FBRyxhQUFZO0NBQ2hELEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLDZDQUE2QyxFQUFFLElBQUksR0FBRyxNQUFNLEdBQUcsY0FBYyxDQUFDLENBQUMsRUFBQztDQUNsRyxHQUFHLE9BQU8sQ0FBQyxJQUFJO0NBQ2YsR0FBRztBQUNIO0NBQ0E7Q0FDQSxFQUFFLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxZQUFZLEdBQUcsYUFBWTtDQUMvQyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUU7Q0FDYixHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMseUVBQXlFLEVBQUM7Q0FDM0YsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDcEUsR0FBRyxPQUFPLElBQUk7Q0FDZCxHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQSxDQUFDLElBQUksZUFBYztDQUNuQixDQUFDLElBQUk7Q0FDTCxFQUFFLGNBQWMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUM7Q0FDdEMsR0FBRyxjQUFjLENBQUMsSUFBSSxFQUFFLE1BQU07Q0FDOUIsSUFBSSxJQUFJLGlCQUFpQixFQUFFLEtBQUssSUFBSSxFQUFFO0NBQ3RDLEtBQUssSUFBSSxDQUFDLFNBQVMsR0FBRyxpQkFBZ0I7Q0FDdEMsS0FBSztDQUNMLElBQUksT0FBTyxpQkFBaUIsRUFBRTtDQUM5QixJQUFJLEVBQUUscUJBQXFCLENBQUM7Q0FDNUIsR0FBRyxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUk7Q0FDMUIsSUFBSSxjQUFjLEdBQUcsUUFBTztDQUM1QixJQUFJLGlCQUFpQixHQUFHLFVBQVUsQ0FBQyxNQUFNO0NBQ3pDLEtBQUssT0FBTyxHQUFFO0NBQ2QsS0FBSyxFQUFFLElBQUksRUFBQztDQUNaLElBQUksQ0FBQztDQUNMLEdBQUcsRUFBQztDQUNKLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRTtDQUNkLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUM7Q0FDbkIsRUFBRTtDQUNGLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDLGlEQUFpRCxFQUFDO0NBQy9FLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQ2xFLENBQUMsWUFBWSxDQUFDLGlCQUFpQixFQUFDO0NBQ2hDLENBQUMsSUFBSSxjQUFjLElBQUksY0FBYyxLQUFLLElBQUksRUFBRTtDQUNoRCxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsdUVBQXVFLEVBQUM7Q0FDeEYsRUFBRSxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUM7Q0FDckIsR0FBRyxjQUFjLENBQUMsSUFBSSxFQUFFLE1BQU0saUJBQWlCLEVBQUUsS0FBSyxJQUFJLEVBQUUsZUFBZSxDQUFDO0NBQzVFLEdBQUcsSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7Q0FDcEQsR0FBRyxFQUFDO0NBQ0osRUFBRTtDQUNGLENBQUMsTUFBTSxLQUFLLEdBQUcsT0FBTyxHQUFFO0NBQ3hCLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLCtCQUErQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLEtBQUssR0FBRyxtQkFBbUIsR0FBRyxlQUFlLENBQUMsQ0FBQyxFQUFDO0NBQ3JILENBQUMsT0FBTyxLQUFLO0NBQ2I7O0NDcFNBO0FBQ0E7QUFHQTtDQUNBLE1BQU0saUJBQWlCLFNBQVMsV0FBVyxDQUFDO0FBQzVDO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLG1DQUFtQyxDQUFDLGVBQWUsRUFBRTtDQUN0RCxFQUFFLE9BQU8sZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxlQUFlLENBQUM7Q0FDckQsRUFBRTtBQUNGO0NBQ0E7O0NDZkE7QUFDQTtBQU1BO0NBQ0EsTUFBTSxTQUFTLFNBQVMsRUFBRSxDQUFDO0FBQzNCO0NBQ0EsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLFVBQVUsR0FBRyxFQUFFLEVBQUU7Q0FDcEMsRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBQztDQUN6QixFQUFFLElBQUksQ0FBQyxhQUFhLEdBQUcsS0FBSTtDQUMzQixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsT0FBTyxNQUFNLENBQUMsTUFBTSxFQUFFO0NBQ3ZCLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQywrQ0FBK0MsRUFBQztDQUNoRSxFQUFFLE1BQU0sc0JBQXNCLEdBQUcsbUJBQW1CLENBQUMsTUFBTSxFQUFDO0NBQzVELEVBQUUsSUFBSSxzQkFBc0IsS0FBSyxJQUFJLEVBQUU7Q0FDdkMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLDhCQUE4QixFQUFFLHNCQUFzQixFQUFDO0NBQ3hFLEdBQUcsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLGlCQUFpQixDQUFDLHNCQUFzQixFQUFDO0NBQzFFLEdBQUcsT0FBTyxJQUFJLFNBQVMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxDQUFDO0NBQ3RELEdBQUcsTUFBTTtDQUNULEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyxpRkFBaUYsQ0FBQztDQUNyRyxHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sbUNBQW1DLENBQUMsZUFBZSxFQUFFO0NBQzVELEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx3Q0FBd0MsRUFBQztDQUN6RCxFQUFFLE9BQU8sTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDLG1DQUFtQyxDQUFDLGVBQWUsQ0FBQztDQUNyRyxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxrQkFBa0IsQ0FBQyxlQUFlLEVBQUU7Q0FDM0MsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHVCQUF1QixFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUM7Q0FDNUQsRUFBRSxNQUFNLHFCQUFxQixHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUMsS0FBSTtBQUN0RTtDQUNBO0NBQ0EsRUFBRSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQjtDQUMxQyxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMscUJBQXFCLENBQUM7Q0FDdEQsS0FBSyxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLHFCQUFxQixFQUFDO0NBQzVGLEVBQUUsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLGFBQWEsS0FBSyxpQkFBZ0I7QUFDN0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLElBQUk7Q0FDTixHQUFHLE1BQU0sY0FBYyxHQUFHLHNCQUFzQixDQUFDLHFCQUFxQixFQUFFLGVBQWUsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFDO0NBQ25HLEdBQUcsSUFBSSxjQUFjLEVBQUU7Q0FDdkIsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLHFEQUFxRCxFQUFDO0NBQ3hFLElBQUksTUFBTSxTQUFTLEdBQUcsSUFBSSxTQUFTLENBQUMsY0FBYyxFQUFDO0NBQ25ELElBQUksT0FBTyxJQUFJLFdBQVcsQ0FBQyxTQUFTLENBQUM7Q0FDckMsSUFBSTtDQUNKLEdBQUcsQ0FBQyxPQUFPLEVBQUUsRUFBRTtDQUNmLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUM7Q0FDcEIsR0FBRztBQUNIO0NBQ0E7Q0FDQSxFQUFFLEtBQUssSUFBSSxJQUFJLEdBQUcsQ0FBQyxFQUFFLElBQUksR0FBRyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUU7Q0FDdkMsR0FBRyxJQUFJLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFO0NBQ3ZDLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyx1REFBdUQsRUFBQztDQUMxRSxJQUFJLE9BQU8sS0FBSztDQUNoQixJQUFJO0FBQ0o7Q0FDQSxHQUFHLElBQUksVUFBVSxFQUFFO0NBQ25CO0NBQ0EsSUFBSSxNQUFNLFNBQVMsR0FBRyxFQUFFLHFCQUFxQixDQUFDLFlBQVksR0FBRyxxQkFBcUIsQ0FBQyxZQUFZLEVBQUM7Q0FDaEcsSUFBSSxNQUFNLFFBQVEsR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxJQUFJO0NBQy9ELE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLFNBQVMsQ0FBQztDQUM5QyxPQUFPLEVBQUM7QUFDUjtDQUNBO0NBQ0EsSUFBSSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBQztDQUMxQyxJQUFJLE1BQU0sSUFBSSxHQUFHLFVBQVUsR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUc7QUFDNUM7Q0FDQSxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxtQ0FBbUMsRUFBRSxJQUFJLENBQUMsV0FBVyxFQUFFLFFBQVEsQ0FBQyxZQUFZLEVBQUUsU0FBUyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFDO0FBQzNIO0NBQ0EsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLFFBQVEsRUFBRSxDQUFDLElBQUksU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0NBQ3pELEtBQUssSUFBSSxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtDQUN6QyxNQUFNLE9BQU8sQ0FBQyxLQUFLLENBQUMsdURBQXVELEVBQUM7Q0FDNUUsTUFBTSxPQUFPLEtBQUs7Q0FDbEIsTUFBTTtDQUNOLEtBQUssSUFBSSxDQUFDLGFBQWEsR0FBRyxFQUFDO0NBQzNCLEtBQUsscUJBQXFCLENBQUMsU0FBUyxHQUFHLEVBQUM7Q0FDeEMsS0FBSyxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBQztDQUN2RSxLQUFLLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLEVBQUM7Q0FDekQsS0FBSyxJQUFJO0NBQ1QsTUFBTSxNQUFNLGNBQWMsR0FBRyxzQkFBc0IsQ0FBQyxxQkFBcUIsRUFBRSxlQUFlLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBQztDQUN0RyxNQUFNLElBQUksY0FBYyxFQUFFO0NBQzFCLE9BQU8sTUFBTSxTQUFTLEdBQUcsSUFBSSxTQUFTLENBQUMsY0FBYyxFQUFDO0NBQ3RELE9BQU8sT0FBTyxJQUFJLFdBQVcsQ0FBQyxTQUFTLENBQUM7Q0FDeEMsT0FBTztDQUNQLE1BQU0sQ0FBQyxPQUFPLEVBQUUsRUFBRTtDQUNsQixNQUFNLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFDO0NBQ3ZCLE1BQU07Q0FDTixLQUFLO0NBQ0wsSUFBSSxNQUFNO0NBQ1Y7Q0FDQSxJQUFJLE1BQU0sU0FBUyxHQUFHLHFCQUFxQixDQUFDLFlBQVksR0FBRyxxQkFBcUIsQ0FBQyxhQUFZO0NBQzdGLElBQUksTUFBTSxjQUFjLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssSUFBSTtDQUNyRSxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxTQUFTLENBQUM7Q0FDOUMsT0FBTyxVQUFTO0FBQ2hCO0NBQ0E7Q0FDQSxJQUFJLE1BQU0sSUFBSSxHQUFHLFNBQVMsR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUc7QUFDM0M7Q0FDQSxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyx3QkFBd0IsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsY0FBYyxDQUFDLFlBQVksRUFBRSxTQUFTLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUM7QUFDNUg7Q0FDQSxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtDQUNuRSxLQUFLLElBQUksZUFBZSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Q0FDekMsTUFBTSxPQUFPLENBQUMsS0FBSyxDQUFDLHVEQUF1RCxFQUFDO0NBQzVFLE1BQU0sT0FBTyxLQUFLO0NBQ2xCLE1BQU07Q0FDTixLQUFLLElBQUksQ0FBQyxhQUFhLEdBQUcsRUFBQztDQUMzQixLQUFLLHFCQUFxQixDQUFDLFNBQVMsR0FBRyxFQUFDO0NBQ3hDLEtBQUsscUJBQXFCLENBQUMsYUFBYSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUM7Q0FDdkUsS0FBSyxNQUFNLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxFQUFDO0NBQ3pELEtBQUssSUFBSTtDQUNULE1BQU0sTUFBTSxjQUFjLEdBQUcsc0JBQXNCLENBQUMscUJBQXFCLEVBQUUsZUFBZSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUM7Q0FDdEcsTUFBTSxJQUFJLGNBQWMsRUFBRTtDQUMxQixPQUFPLE1BQU0sU0FBUyxHQUFHLElBQUksU0FBUyxDQUFDLGNBQWMsRUFBQztDQUN0RCxPQUFPLE9BQU8sSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDO0NBQ3hDLE9BQU87Q0FDUCxNQUFNLENBQUMsT0FBTyxFQUFFLEVBQUU7Q0FDbEIsTUFBTSxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBQztDQUN2QixNQUFNO0NBQ04sS0FBSztDQUNMLElBQUk7QUFDSjtDQUNBO0NBQ0E7Q0FDQSxHQUFHLElBQUksQ0FBQyxhQUFhLEdBQUcsS0FBSTtDQUM1QixHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyx5QkFBeUIsRUFBRSxJQUFJLENBQUMsd0JBQXdCLENBQUMsRUFBQztDQUM1RSxHQUFHO0FBQ0g7Q0FDQSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsNERBQTRELEVBQUM7Q0FDN0UsRUFBRSxPQUFPLEtBQUs7Q0FDZCxFQUFFO0FBQ0Y7Q0FDQTs7Q0MvSkE7Q0FDQTtDQUNBO0NBQ0E7QUFDQTtBQUlBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDZSxTQUFTLEtBQUssR0FBRztDQUNoQyxDQUFDLE9BQU8sU0FBUztDQUNqQjs7Q0NmQTtBQUNBO0FBT0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxNQUFNLElBQUksQ0FBQztBQUNYO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxFQUFFLEVBQUU7Q0FDakIsRUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUU7Q0FDZixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Q0FDdkIsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLGFBQWEsRUFBQztDQUM5QixFQUFFLE1BQU0sRUFBRSxHQUFHLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUM7Q0FDbkMsRUFBRSxPQUFPLElBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQztDQUNyQixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsbUNBQW1DLENBQUMsZUFBZSxFQUFFO0NBQ3RELEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQywwQ0FBMEMsRUFBQztDQUMzRCxFQUFFLE9BQU8sSUFBSSxDQUFDLEVBQUUsQ0FBQyxtQ0FBbUMsQ0FBQyxlQUFlLENBQUM7Q0FDckUsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLGtCQUFrQixDQUFDLGVBQWUsRUFBRTtDQUNyQyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMseUJBQXlCLEVBQUM7Q0FDMUMsRUFBRSxPQUFPLElBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsZUFBZSxDQUFDO0NBQ3BELEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLEVBQUUsR0FBRztDQUNWLEVBQUUsT0FBTyxJQUFJLENBQUMsR0FBRztDQUNqQixFQUFFO0FBQ0Y7Q0FDQTs7Q0MzREE7QUFDQTtBQUlBO0NBQ0EsTUFBTSxJQUFJLENBQUM7QUFDWDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsWUFBWSxFQUFFO0NBQ25DLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxPQUFNO0NBQ3RCLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFJO0NBQ2xCLEVBQUUsSUFBSSxDQUFDLFlBQVksR0FBRyxhQUFZO0NBQ2xDLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLEVBQUU7Q0FDckMsRUFBRSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsZUFBZSxDQUFDO0NBQ3RELEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFO0NBQ3JCLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUM7Q0FDekIsRUFBRTtBQUNGO0FBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxtQ0FBbUMsQ0FBQyxlQUFlLEVBQUU7Q0FDdEQsRUFBRSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsbUNBQW1DLENBQUMsZUFBZSxDQUFDO0NBQ3ZFLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsUUFBUSxHQUFHO0NBQ1osRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBQztDQUMzQixFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFDO0NBQ3RDLEVBQUU7QUFDRjtBQUNBO0NBQ0E7O0NDdERBO0FBQ0E7QUFHQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsTUFBTSxjQUFjLENBQUM7QUFDckI7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRTtDQUNuQixFQUFFLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSTtDQUNuQixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxTQUFTLEdBQUc7Q0FDYixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxHQUFHO0NBQ1IsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLEtBQUssR0FBRztDQUNULEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLEdBQUcsR0FBRztDQUNiLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLElBQUksR0FBRztDQUNaLEVBQUUsT0FBTyxJQUFJLENBQUMsS0FBSztDQUNuQixFQUFFO0FBQ0Y7Q0FDQTs7Q0N4REE7QUFDQTtBQUlBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxNQUFNLGVBQWUsU0FBUyxjQUFjLENBQUM7QUFDN0M7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUU7Q0FDbkIsRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFDO0NBQ2IsRUFBRSxJQUFJLENBQUMsZUFBZSxHQUFHLE1BQUs7Q0FDOUIsRUFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLEVBQUM7Q0FDdkIsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsRUFBQztDQUM1QixFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBSztDQUN2QixFQUFFLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxLQUFJO0NBQzlCLEVBQUUsSUFBSSxDQUFDLGVBQWUsR0FBRyxLQUFJO0NBQzdCLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixHQUFHLEVBQUM7Q0FDL0IsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxTQUFTLEdBQUc7Q0FDYixFQUFFLE9BQU8sSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFPLEtBQUssS0FBSztDQUNqRyxFQUFFO0FBQ0Y7Q0FDQSxDQUFDLElBQUksR0FBRztDQUNSLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsRUFBQztDQUN2QyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsRUFBQztDQUN4QyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMseUJBQXlCLEVBQUM7Q0FDeEQsRUFBRTtBQUNGO0NBQ0EsQ0FBQyxLQUFLLEdBQUc7Q0FDVCxFQUFFLElBQUksQ0FBQyxlQUFlLEdBQUcsTUFBSztDQUM5QixFQUFFLElBQUksQ0FBQyxZQUFZLEdBQUcsRUFBQztDQUN2QixFQUFFLElBQUksQ0FBQyxlQUFlLEdBQUcsS0FBSTtDQUM3QixFQUFFLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxFQUFDO0NBQzVCLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixHQUFHLEVBQUM7Q0FDL0IsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUM7Q0FDbEMsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLEdBQUcsR0FBRztDQUNiLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsRUFBQztDQUN4QyxFQUFFLElBQUksQ0FBQyxZQUFZLEdBQUcsRUFBQztDQUN2QixFQUFFLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxFQUFDO0NBQzVCLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixHQUFHLEVBQUM7Q0FDL0IsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUk7Q0FDdEIsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxlQUFlLEdBQUU7Q0FDL0M7Q0FDQSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLElBQUk7Q0FDakYsR0FBRyxFQUFFLENBQUMsZUFBZSxDQUFDLGtCQUFrQixFQUFDO0NBQ3pDLEdBQUcsRUFBQztDQUNKLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEdBQUU7Q0FDdEIsRUFBRSxJQUFJO0NBQ04sR0FBRyxJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUU7Q0FDN0IsSUFBSSxNQUFNLElBQUksQ0FBQyxrQkFBa0IsR0FBRTtDQUNuQyxJQUFJLE1BQU07Q0FDVixJQUFJLE1BQU0sSUFBSSxDQUFDLGFBQWEsR0FBRTtDQUM5QixJQUFJO0FBQ0o7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxHQUFHLElBQUksSUFBSSxDQUFDLFlBQVksS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtDQUN6RSxJQUFJLEtBQUssSUFBSSxLQUFLLEdBQUcsQ0FBQyxFQUFFLEtBQUssSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUU7Q0FDN0MsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLGdDQUFnQyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBQztDQUM5RSxLQUFLLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyx5Q0FBeUMsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUM7Q0FDekUsS0FBSyxNQUFNLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxFQUFDO0NBQzVELEtBQUssSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxLQUFLO0NBQ3BEO0NBQ0EsS0FBSyxJQUFJLENBQUMsZUFBZSxHQUFHLE1BQUs7Q0FDakMsS0FBSyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsRUFBQztDQUNsQyxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLElBQUk7Q0FDcEYsTUFBTSxFQUFFLENBQUMsZUFBZSxDQUFDLGtCQUFrQixFQUFDO0NBQzVDLE1BQU0sRUFBQztDQUNQLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEdBQUU7Q0FDekIsS0FBSyxNQUFNLElBQUksQ0FBQyxhQUFhLEdBQUU7Q0FDL0IsS0FBSyxJQUFJLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEtBQUs7Q0FDN0UsS0FBSztDQUNMLElBQUk7QUFDSjtDQUNBLEdBQUcsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtDQUM3QyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsbUJBQW1CLENBQUMsRUFBQztDQUMvRSxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMseUJBQXlCLEVBQUM7Q0FDNUMsSUFBSSxNQUFNO0NBQ1YsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLG1CQUFtQixDQUFDLEVBQUM7Q0FDNUUsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLHNCQUFzQixFQUFDO0NBQ3pDLElBQUk7Q0FDSixHQUFHLENBQUMsT0FBTyxFQUFFLEVBQUU7Q0FDZixHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFDO0NBQ3BCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsQ0FBQyxFQUFDO0NBQzlFLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsRUFBQztDQUMzQyxHQUFHO0NBQ0gsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQUs7Q0FDdkIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sYUFBYSxHQUFHO0NBQ3ZCLEVBQUUsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtDQUM1QyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0VBQWtFLEVBQUM7Q0FDcEYsR0FBRyxNQUFNO0NBQ1QsR0FBRztDQUNILEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsc0JBQXNCLEVBQUM7Q0FDakQsRUFBRSxJQUFJO0NBQ04sR0FBRyxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsbUNBQW1DLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFDO0NBQzFGLEdBQUcsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE9BQU8sS0FBSyxLQUFLLEVBQUU7Q0FDdkQsSUFBSSxJQUFJLElBQUksRUFBRTtDQUNkLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsd0JBQXdCLENBQUMsRUFBQztDQUNuRyxLQUFLLElBQUksQ0FBQyxlQUFlLEdBQUcsS0FBSTtDQUNoQyxLQUFLLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixHQUFFO0NBQ3BDLEtBQUssTUFBTTtDQUNYLEtBQUssSUFBSSxDQUFDLGlCQUFpQixHQUFFO0NBQzdCLEtBQUssTUFBTSxJQUFJLENBQUMsYUFBYSxHQUFFO0NBQy9CLEtBQUs7Q0FDTCxJQUFJLE1BQU07Q0FDVixJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0VBQWtFLEVBQUM7Q0FDckYsSUFBSTtDQUNKLEdBQUcsQ0FBQyxPQUFPLEVBQUUsRUFBRTtDQUNmLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUM7Q0FDcEIsR0FBRztDQUNILEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLGtCQUFrQixHQUFHO0NBQzVCLEVBQUUsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtDQUM1QyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsdUVBQXVFLEVBQUM7Q0FDekYsR0FBRyxNQUFNO0NBQ1QsR0FBRztDQUNILEVBQUUsSUFBSSxJQUFJLENBQUMsb0JBQW9CLElBQUksQ0FBQyxFQUFFO0NBQ3RDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLHVCQUF1QixFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsbUJBQW1CLENBQUMsRUFBQztDQUNqSSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0RBQXNELEVBQUM7Q0FDeEUsR0FBRyxNQUFNO0NBQ1QsR0FBRztDQUNILEVBQUUsSUFBSSxTQUFTLEdBQUcsS0FBSTtDQUN0QixFQUFFLElBQUksVUFBVSxHQUFHLEtBQUk7Q0FDdkIsRUFBRSxJQUFJO0NBQ04sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLDRCQUE0QixFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLEVBQUM7Q0FDN0YsR0FBRyxNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFDO0NBQ2hGLEdBQUcsU0FBUyxHQUFHLFdBQVcsS0FBSyxNQUFLO0NBQ3BDLEdBQUcsSUFBSSxXQUFXLEVBQUU7Q0FDcEIsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLHNCQUFzQixFQUFFLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDO0FBQzlFO0NBQ0E7Q0FDQSxJQUFJLElBQUksSUFBSSxDQUFDLGVBQWUsS0FBSyxJQUFJLEVBQUU7Q0FDdkMsS0FBSyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLEdBQUU7Q0FDaEUsS0FBSyxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsSUFBSSxFQUFDO0NBQzdELEtBQUssSUFBSSxPQUFPLEdBQUcsUUFBUSxFQUFFO0NBQzdCLE1BQU0sTUFBTSxNQUFNLEdBQUcsUUFBUSxHQUFHLFFBQU87Q0FDdkMsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLE1BQU0sR0FBRyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxFQUFDO0NBQy9HLE1BQU0sTUFBTSxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsRUFBQztDQUMvRCxNQUFNO0NBQ04sS0FBSztBQUNMO0NBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLE1BQU07QUFDcEQ7Q0FDQSxJQUFJLFVBQVUsR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDLEtBQUk7Q0FDM0MsSUFBSSxNQUFNLE1BQU0sR0FBRyxNQUFNLFdBQVcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFDO0FBQ2xFO0NBQ0EsSUFBSSxJQUFJLE1BQU0sRUFBRTtDQUNoQjtDQUNBLEtBQUssTUFBTSxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsRUFBQztDQUMzRCxLQUFLLE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxXQUFXLElBQUksQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLGtCQUFrQixFQUFDO0NBQzlGLEtBQUssSUFBSSxVQUFVLEVBQUU7Q0FDckI7Q0FDQSxNQUFNLE9BQU8sQ0FBQyxLQUFLLENBQUMseUVBQXlFLEVBQUM7Q0FDOUYsTUFBTSxVQUFVLENBQUMsZUFBZSxDQUFDLGtCQUFrQixFQUFDO0NBQ3BELE1BQU0sSUFBSSxDQUFDLG9CQUFvQixHQUFFO0NBQ2pDLE1BQU0sTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxDQUFDLENBQUMsRUFBQztDQUMxRixNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsaUNBQWlDLEVBQUUsQ0FBQyxTQUFTLEdBQUcsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsRUFBQztDQUNwSSxNQUFNLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLEVBQUM7Q0FDbEUsTUFBTSxNQUFNO0NBQ1osTUFBTSxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksSUFBSSxHQUFFO0NBQ3ZDLE1BQU0sSUFBSSxDQUFDLFlBQVksR0FBRTtDQUN6QixNQUFNLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxFQUFDO0NBQ25DO0NBQ0EsTUFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRTtDQUMvQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxhQUFhLEdBQUcsS0FBSTtDQUM3QyxPQUFPO0NBQ1AsTUFBTTtDQUNOLEtBQUssTUFBTTtDQUNYO0NBQ0EsS0FBSyxPQUFPLENBQUMsS0FBSyxDQUFDLDBFQUEwRSxFQUFDO0NBQzlGLEtBQUssVUFBVSxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsRUFBQztDQUNuRCxLQUFLLElBQUksQ0FBQyxvQkFBb0IsR0FBRTtDQUNoQyxLQUFLO0NBQ0wsSUFBSTtDQUNKLEdBQUcsQ0FBQyxPQUFPLEVBQUUsRUFBRTtDQUNmLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUM7Q0FDcEI7Q0FDQSxHQUFHLElBQUksVUFBVSxFQUFFO0NBQ25CLElBQUksVUFBVSxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsRUFBQztDQUNsRCxJQUFJO0NBQ0osR0FBRyxJQUFJLENBQUMsb0JBQW9CLEdBQUU7Q0FDOUIsR0FBRyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixHQUFHLENBQUMsQ0FBQyxFQUFDO0NBQ3ZGLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxTQUFTLEdBQUcsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsRUFBQztDQUM5SixHQUFHLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLEVBQUM7Q0FDL0QsR0FBRyxTQUFTO0NBQ1osR0FBRyxJQUFJLFNBQVMsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtDQUNwRixJQUFJLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixHQUFFO0NBQ25DLElBQUk7Q0FDSixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7O0NDM05BO0FBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUywwQkFBMEIsQ0FBQyxRQUFRLEVBQUU7Q0FDckQsQ0FBQyxNQUFNLG9CQUFvQixHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFDO0NBQzNELENBQUMsb0JBQW9CLENBQUMsRUFBRSxHQUFHLGNBQWE7Q0FDeEMsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFFBQU87Q0FDOUMsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLE9BQU07Q0FDeEMsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLE9BQU07Q0FDMUMsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU07Q0FDNUMsQ0FBQyxPQUFPLG9CQUFvQjtDQUM1Qjs7Q0NmQTtBQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLG9CQUFvQixDQUFDLFFBQVEsRUFBRTtDQUMvQyxDQUFDLE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFDO0NBQ3JELENBQUMsY0FBYyxDQUFDLEVBQUUsR0FBRyxlQUFjO0NBQ25DLENBQUMsY0FBYyxDQUFDLFFBQVEsR0FBRyxFQUFDO0NBQzVCLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsSUFBRztDQUMvQixDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUc7Q0FDakMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxRQUFPO0NBQ3hDLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBTztDQUNyQyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLFFBQU87Q0FDdEMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFLO0NBQ3BDLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsWUFBVztDQUNuRCxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU07Q0FDdEMsQ0FBQyxPQUFPLGNBQWM7Q0FDdEI7O0NDbkJBO0NBQ0E7Q0FDQTtBQUNBO0FBVUE7Q0FDQSxNQUFNLEdBQUcsQ0FBQztDQUNWO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSwwQkFBMEIsRUFBRSxhQUFhLEVBQUU7Q0FDckcsRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVE7Q0FDM0IsRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUk7Q0FDbkIsRUFBRSxJQUFJLENBQUMsZUFBZSxHQUFHLGVBQWM7Q0FDdkMsRUFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVc7Q0FDakMsRUFBRSxJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWE7Q0FDckMsRUFBRSxJQUFJLENBQUMsMkJBQTJCLEdBQUcsMkJBQTBCO0NBQy9ELEVBQUUsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDO0NBQ2xFLEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFDO0NBQ2xELEVBQUUsSUFBSSxDQUFDLGNBQWMsR0FBRyxNQUFLO0NBQzdCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE9BQU8sTUFBTSxDQUFDLE1BQU0sRUFBRTtDQUN2QixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFDO0NBQ3pCLEVBQUUsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFDO0NBQ3hDLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUM7Q0FDM0MsRUFBRSxPQUFPLEVBQUU7Q0FDWCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxRQUFRLEVBQUU7Q0FDekIsRUFBRSxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBQztDQUM1QyxFQUFFLElBQUksQ0FBQyxFQUFFLEdBQUcsWUFBVztDQUN2QixFQUFFLE1BQU0sV0FBVyxHQUFHLGlCQUFpQixDQUFDLFFBQVEsRUFBQztDQUNqRCxFQUFFLE1BQU0sY0FBYyxHQUFHLG9CQUFvQixDQUFDLFFBQVEsRUFBQztDQUN2RCxFQUFFLE1BQU0sb0JBQW9CLEdBQUcsMEJBQTBCLENBQUMsUUFBUSxFQUFDO0NBQ25FLEVBQUUsTUFBTSwwQkFBMEIsR0FBRyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsZ0JBQWdCLEVBQUUsWUFBWSxDQUFDLE9BQU8sRUFBQztDQUM5RyxFQUFFLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFDO0NBQ3JELEVBQUUsYUFBYSxDQUFDLFdBQVcsR0FBRyxRQUFPO0NBQ3JDLEVBQUUsYUFBYSxDQUFDLEVBQUUsR0FBRyxjQUFhO0NBQ2xDLEVBQUUsYUFBYSxDQUFDLEtBQUssR0FBRyxlQUFjO0NBQ3RDLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsY0FBYyxFQUFDO0NBQzNDLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsb0JBQW9CLEVBQUM7Q0FDakQsRUFBRSxXQUFXLENBQUMsV0FBVyxDQUFDLDBCQUEwQixFQUFDO0NBQ3JELEVBQUUsV0FBVyxDQUFDLFdBQVcsQ0FBQyxhQUFhLEVBQUM7Q0FDeEMsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBQztDQUMvQixFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSwwQkFBMEIsRUFBRSxhQUFhLEVBQUM7Q0FDNUcsRUFBRSxRQUFRLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsRUFBQztDQUM5RSxFQUFFLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxLQUFLLEtBQUssRUFBRSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxFQUFDO0NBQzVFLEVBQUUsMEJBQTBCLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQyxrQ0FBa0MsQ0FBQyxLQUFLLENBQUMsRUFBQztDQUMvRyxFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLGdCQUFnQixDQUFDLENBQUMsU0FBUyxLQUFLLEVBQUUsQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxFQUFDO0NBQzVGLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxFQUFDO0NBQ2xFLEVBQUUsMEJBQTBCLENBQUMsZUFBZSxHQUFHLDBCQUEwQixDQUFDLFlBQVc7Q0FDckYsRUFBRSwwQkFBMEIsQ0FBQyxtQkFBbUIsR0FBRywwQkFBMEIsQ0FBQyxLQUFLLENBQUMsZ0JBQWU7Q0FDbkcsRUFBRSxPQUFPLEVBQUU7Q0FDWCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRTtDQUNwQixFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxHQUFHLEtBQUk7Q0FDdkMsRUFBRTtBQUNGO0NBQ0EsQ0FBQyxNQUFNLGVBQWUsR0FBRztDQUN6QixFQUFFLElBQUksQ0FBQyxjQUFjLEdBQUcsS0FBSztDQUM3QixHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxNQUFNLEtBQUssSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSTtDQUNuSSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLFNBQVE7Q0FDckMsR0FBRyxNQUFNLENBQUMsUUFBUSxHQUFHLEtBQUk7Q0FDekIsR0FBRyxFQUFDO0NBQ0osRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsR0FBRTtDQUN4QyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxHQUFFO0NBQzdCLEVBQUUsSUFBSSxDQUFDLDBCQUEwQixDQUFDLFdBQVcsR0FBRyxrQkFBaUI7Q0FDakUsRUFBRSxJQUFJLENBQUMsMEJBQTBCLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxVQUFTO0NBQ25FLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLFFBQU87Q0FDMUMsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxHQUFFO0NBQ3JDLEVBQUUsSUFBSTtDQUNOLEdBQUcsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsR0FBRTtDQUM1QixHQUFHLENBQUMsTUFBTSxLQUFLLEVBQUU7Q0FDakIsR0FBRyxHQUFHLElBQUksQ0FBQyxjQUFjLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsT0FBTyxFQUFFO0NBQzdFLElBQUksTUFBTTtDQUNWLElBQUk7Q0FDSixHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFDO0NBQ3ZCLEdBQUcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxFQUFFO0NBQ2pDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUU7Q0FDeEIsSUFBSTtDQUNKLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxrTEFBa0wsRUFBQztDQUN0TixHQUFHLFNBQVM7Q0FDWixHQUFHLElBQUksQ0FBQyxvQkFBb0IsR0FBRTtDQUM5QixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUU7Q0FDbEIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQywrQkFBK0IsQ0FBQyxLQUFLLElBQUksSUFBSSxFQUFFLEVBQUU7Q0FDMUYsR0FBRyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtDQUM5QixJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEdBQUU7Q0FDdkMsSUFBSTtDQUNKLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksZ0JBQWdCLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFDO0NBQ2hGLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsK0JBQStCLENBQUMsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxFQUFDO0NBQzlJLEdBQUc7Q0FDSCxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtDQUM3RCxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxFQUFFO0NBQ2xDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUU7Q0FDekIsSUFBSTtDQUNKLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLEdBQUU7Q0FDL0IsR0FBRyxNQUFNO0NBQ1QsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsT0FBTTtDQUNuQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsRUFBRTtDQUNqQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxHQUFFO0NBQ3hCLElBQUk7Q0FDSixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsa0NBQWtDLEdBQUc7Q0FDdEMsRUFBRSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLEVBQUU7Q0FDaEMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLDJDQUEyQyxFQUFDO0NBQzdELEdBQUcsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFJO0NBQzdCLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUU7Q0FDdkIsR0FBRyxJQUFJLENBQUMsb0JBQW9CLEdBQUU7Q0FDOUIsR0FBRyxNQUFNO0NBQ1QsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLDZGQUE2RixFQUFDO0NBQy9HLEdBQUcsSUFBSSxDQUFDLGVBQWUsR0FBRTtDQUN6QixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFO0NBQzFCLEVBQUUsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxFQUFFO0NBQ2hDLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrR0FBa0csRUFBQztDQUNsSCxHQUFHLEtBQUssQ0FBQyx3QkFBd0IsR0FBRTtDQUNuQyxHQUFHLEtBQUssQ0FBQyxjQUFjLEdBQUU7Q0FDekIsR0FBRyxLQUFLLENBQUMsZUFBZSxHQUFFO0NBQzFCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEdBQUU7Q0FDOUIsR0FBRyxPQUFPLEtBQUs7Q0FDZixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0EsQ0FBQyxvQkFBb0IsR0FBRztDQUN4QixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsNEJBQTRCLENBQUM7Q0FDN0MsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksTUFBTSxLQUFLLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLElBQUk7Q0FDbkksR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxHQUFFO0NBQy9CLEdBQUcsTUFBTSxDQUFDLFFBQVEsR0FBRyxNQUFLO0NBQzFCLEdBQUcsRUFBQztDQUNKLEVBQUUsSUFBSSxDQUFDLDBCQUEwQixDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsZ0JBQWU7Q0FDL0YsRUFBRSxJQUFJLENBQUMsMEJBQTBCLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsb0JBQW1CO0NBQzdHLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU07Q0FDNUMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRTtDQUNyQyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLEVBQUM7Q0FDMUUsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksUUFBUSxHQUFHO0NBQ2hCLEVBQUUsT0FBTyxJQUFJLENBQUMsU0FBUztDQUN2QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxNQUFNLEdBQUc7Q0FDZCxFQUFFLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXO0NBQ25DLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLElBQUksR0FBRztDQUNaLEVBQUUsT0FBTyxJQUFJLENBQUMsS0FBSztDQUNuQixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxjQUFjLEdBQUc7Q0FDdEIsRUFBRSxPQUFPLElBQUksQ0FBQyxlQUFlO0NBQzdCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLFdBQVcsR0FBRztDQUNuQixFQUFFLE9BQU8sSUFBSSxDQUFDLFlBQVk7Q0FDMUIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksMEJBQTBCLEdBQUc7Q0FDbEMsRUFBRSxPQUFPLElBQUksQ0FBQywyQkFBMkI7Q0FDekMsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksYUFBYSxHQUFHO0NBQ3JCLEVBQUUsT0FBTyxJQUFJLENBQUMsY0FBYztDQUM1QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxRQUFRLEdBQUc7Q0FDaEIsRUFBRSxPQUFPLElBQUksQ0FBQyxTQUFTO0NBQ3ZCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLElBQUksR0FBRztDQUNaLEVBQUUsT0FBTyxJQUFJLENBQUMsS0FBSztDQUNuQixFQUFFO0FBQ0Y7Q0FDQTs7Q0NuUUE7QUFDQTtBQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFO0NBQzdCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUM7Q0FDbkIsQ0FBQztBQUNEO0NBQ0EsR0FBRyxPQUFPLE1BQU0sS0FBSyxXQUFXLEVBQUU7Q0FDbEMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFDO0NBQ2I7Ozs7Ozs7Ozs7In0=
