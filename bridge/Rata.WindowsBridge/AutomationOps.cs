using System.Windows.Automation;

namespace Rata.WindowsBridge;

/// <summary>
/// UI Automation inspect, invoke and set-value. RATA-005.
/// </summary>
/// <remarks>
/// <para>
/// Elements are addressed by an id this process issues, not by a path or a
/// pointer the caller composes. A caller names a window, receives a flat list
/// of elements with ids, and may then act on one of those ids. It cannot
/// describe an element that was never offered to it, which is the same shape as
/// the screen-capture handle in ADR-020 and the app-catalog id in RATA-016: the
/// model names a thing from a list, it does not construct a reference.
/// </para>
/// <para>
/// Ids are scoped to the window they were produced from and invalidated when a
/// different window is inspected, so an id cannot be replayed against another
/// application after the fact.
/// </para>
/// </remarks>
internal sealed class AutomationSession
{
    /// <summary>Most elements returned from one inspection.</summary>
    private const int MaxElements = 300;
    /// <summary>Longest name reported per element.</summary>
    private const int MaxNameLength = 200;

    private readonly Dictionary<string, AutomationElement> _elements = new(StringComparer.Ordinal);
    private long _window;
    private int _counter;

    /// <summary>
    /// Walks the element tree of one window and returns a flat, addressable
    /// list.
    /// </summary>
    internal IReadOnlyList<ElementInfo> Inspect(IntPtr window)
    {
        // Inspecting a different window retires the previous ids rather than
        // letting them accumulate across applications.
        if (_window != window.ToInt64())
        {
            _elements.Clear();
            _window = window.ToInt64();
        }

        var root = AutomationElement.FromHandle(window);
        var results = new List<ElementInfo>();
        if (root is null) return results;

        // Breadth-first with an explicit queue. Recursion over a hostile or
        // merely deep UI tree is a stack-overflow risk, and a crash here takes
        // the bridge down mid-session.
        var queue = new Queue<AutomationElement>();
        queue.Enqueue(root);
        while (queue.Count > 0 && results.Count < MaxElements)
        {
            var element = queue.Dequeue();
            ElementInfo? info;
            try
            {
                info = Describe(element);
            }
            catch (ElementNotAvailableException)
            {
                // The UI changed while we walked it. Ordinary, not an error.
                continue;
            }
            if (info is not null) results.Add(info);

            try
            {
                var children = element.FindAll(TreeScope.Children, Condition.TrueCondition);
                foreach (AutomationElement child in children)
                {
                    if (queue.Count + results.Count > MaxElements * 2) break;
                    queue.Enqueue(child);
                }
            }
            catch (ElementNotAvailableException)
            {
                // Same: the subtree vanished.
            }
        }
        return results;
    }

    private ElementInfo? Describe(AutomationElement element)
    {
        var current = element.Current;
        var hasInvoke = element.TryGetCurrentPattern(InvokePattern.Pattern, out _);
        var hasValue = element.TryGetCurrentPattern(ValuePattern.Pattern, out var valueObject);
        var writableValue = hasValue && valueObject is ValuePattern value && !value.Current.IsReadOnly;

        // Only elements something can actually be done to, or that carry a
        // name worth reporting. A tree of anonymous containers is noise that
        // pushes the useful elements past the cap.
        var name = current.Name ?? string.Empty;
        if (!hasInvoke && !writableValue && name.Length == 0) return null;

        _counter++;
        var id = "e" + _counter.ToString();
        _elements[id] = element;

        return new ElementInfo
        {
            ElementId = id,
            Name = name.Length > MaxNameLength ? name[..MaxNameLength] : name,
            ControlType = current.ControlType?.ProgrammaticName ?? string.Empty,
            AutomationId = current.AutomationId ?? string.Empty,
            Enabled = current.IsEnabled,
            CanInvoke = hasInvoke,
            CanSetValue = writableValue
        };
    }

    /// <summary>
    /// Invokes an element previously returned by <see cref="Inspect"/>.
    /// </summary>
    internal bool Invoke(string elementId, out string error)
    {
        error = string.Empty;
        if (!_elements.TryGetValue(elementId, out var element))
        {
            error = "That element is no longer available.";
            return false;
        }
        try
        {
            if (!element.TryGetCurrentPattern(InvokePattern.Pattern, out var pattern) || pattern is not InvokePattern invoke)
            {
                error = "That element cannot be invoked.";
                return false;
            }
            if (!element.Current.IsEnabled)
            {
                error = "That element is disabled.";
                return false;
            }
            invoke.Invoke();
            return true;
        }
        catch (ElementNotAvailableException)
        {
            error = "That element is no longer available.";
            return false;
        }
        catch (InvalidOperationException)
        {
            error = "That element cannot be invoked.";
            return false;
        }
    }

    /// <summary>Sets the value of an element that reports a writable value.</summary>
    internal bool SetValue(string elementId, string value, out string error)
    {
        error = string.Empty;
        if (!_elements.TryGetValue(elementId, out var element))
        {
            error = "That element is no longer available.";
            return false;
        }
        try
        {
            if (!element.TryGetCurrentPattern(ValuePattern.Pattern, out var pattern) || pattern is not ValuePattern valuePattern)
            {
                error = "That element does not accept a value.";
                return false;
            }
            if (valuePattern.Current.IsReadOnly)
            {
                error = "That element is read only.";
                return false;
            }
            if (!element.Current.IsEnabled)
            {
                error = "That element is disabled.";
                return false;
            }
            valuePattern.SetValue(value);
            return true;
        }
        catch (ElementNotAvailableException)
        {
            error = "That element is no longer available.";
            return false;
        }
        catch (InvalidOperationException)
        {
            error = "That element does not accept a value.";
            return false;
        }
    }

    /// <summary>Drops every issued id. Used when a session ends.</summary>
    internal void Clear()
    {
        _elements.Clear();
        _window = 0;
    }
}
