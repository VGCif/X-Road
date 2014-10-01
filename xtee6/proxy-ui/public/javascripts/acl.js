(function(ACL, $, undefined) {

    var oSubjects;

    function enableActions() {
        if ($("#subjects .row_selected").length > 0) {
            $("#service_acl_subjects_remove_selected").enable();
        } else {
            $("#service_acl_subjects_remove_selected").disable();
        }
    }

    function initServiceAclDialogs() {
        $("#service_acl_dialog").initDialog({
            autoOpen: false,
            modal: true,
            height: 490,
            width: "95%",
            open: function() {
                oSubjects.fnAdjustColumnSizing();
            },
            buttons: [
                { text: _("common.close"),
                  click: function() {
                      SERVICES.updateSubjectsCount(oSubjects.fnGetData().length);
                      $(this).dialog("close");
                  }
                }
            ]
        });
    }

    function initServiceAclSubjectsTable() {
        var opts = scrollableTableOpts(230);
        opts.sDom = "<'dataTables_header'f<'clearer'>>t";
        opts.aoColumns = [
            { "mData": "name_description" },
            {
                mData: function(source, type, val) {
                    return generateIdElement({
                        "Type": source.type,
                        "Instance": source.sdsb,
                        "Class": source.member_class,
                        "Code": source.member_group_code,
                        "Subsystem": source.subsystem_code
                    });
                }
            },
            { "mData": "rights_given" }
        ];

        oSubjects = $("#subjects").dataTable(opts);

        $("#subjects_actions")
            .appendTo("#subjects_wrapper .dataTables_header");

        $("#subjects_actions .select_all").change(function() {
            var select = $(this).attr("checked");

            oSubjects.$('tr', {"filter": "applied"}).each(function(idx, val) {
                if (select) {
                    $(val).addClass("row_selected");
                } else {
                    $(val).removeClass("row_selected");
                }
            });

            enableActions();
        });

        var dialog = $("#service_acl_dialog");

        $(".simple_search a", dialog).click(function() {
            $("#subjects_filter", dialog).hide();
            $(".simple_search", dialog).hide();
            $(".advanced_search", dialog).show();

            dialog.trigger("dialogresizestop");
        });

        $(".advanced_search a", dialog).click(function() {
            $(".advanced_search .clear", dialog).click();
            $(".advanced_search", dialog).hide();
            $(".simple_search", dialog).show();
            $("#subjects_filter", dialog).show();

            dialog.trigger("dialogresizestop");
        }).click();

        $(".advanced_search .search", dialog).click(function() {
            var map = [0, 5, 4, 1, 2, 3];

            $(".advanced_search input, .advanced_search select", dialog).each(
                function(idx, val) {
                    oSubjects.fnFilter($(this).val(), map[idx]);
                });
            return false;
        });

        $(".advanced_search .clear", dialog).click(function() {
            $(".advanced_search input, .advanced_search select", dialog).val("");
            oSubjects.fnFilterClear();
            return false;
        });
    }

    function initServiceAclActions() {
        $("#service_acl_dialog #service").change(function() {
            var selected = $("option:selected", this);
            var params = {
                client_id: $("#details_client_id").val(),
                service_code: selected.val()
            };

            $.get(action("service_acl"), params, function(response) {
                oSubjects.fnClearTable();

                var titleText = selected.data("title")
                    ? "clients.service_acl_dialog.title_with_service_title"
                    : "clients.service_acl_dialog.title";

                var title = _(titleText, {
                    code: selected.val(),
                    title: selected.data("title")
                });

                $("#subjects_actions .select_all").removeAttr("checked");
                $("#service_acl_dialog").dialog("option", "title", title);

                oSubjects.fnAddData(response.data);
                enableActions();

                $("#service_acl_dialog").dialog("open");
            }, "json");
        });

        $("#subjects tbody tr").live("click", function() {
            oSubjects.setFocus(0, this, true);
            if ($("#subjects_actions .select_all").prop('checked'))
                $("#subjects_actions .select_all").prop('checked', false);
            enableActions();
        });

        $("#service_acl_subjects_add").click(function() {
            ACL_SUBJECTS_SEARCH.openDialog(oSubjects.fnGetData(), function(subjectIds) {
                var service = $("#service_acl_dialog #service option:selected");
                var params = {
                    client_id: $("#details_client_id").val(),
                    service_code: service.val(),
                    subject_ids: subjectIds
                };

                $.post(action("service_acl_subjects_add"), params, function(response) {
                    oSubjects.fnClearTable();
                    oSubjects.fnAddData(response.data);
                });
            });
        });

        $("#service_acl_subjects_remove_selected").click(function() {
            var service = $("#service_acl_dialog #service option:selected");
            var params = {
                client_id: $("#details_client_id").val(),
                service_code: service.val(),
                subject_ids: []
            };

            var subjects = [];
            $("#subjects .row_selected").each(function(i, row) {
                var selected = oSubjects.fnGetData(row);
                var subject = [
                    selected.type,
                    selected.name_description,
                    selected.member_group_code];

                if (oSubjects.fnGetData(row).subsystem_code !== null) {
                    subject.push(oSubjects.fnGetData(row).subsystem_code);
                }

                subjects.push('<li>' + subject.join(', ') + '</li>');
            });

            var joinedSubjects = '<ol class="alert-ol">' + subjects.join('') + '</ol>';

            confirm("clients.service_acl_dialog.remove_selected_confirm",
                    {subjects: joinedSubjects}, function() {

                $("#subjects .row_selected").each(function(idx, row) {
                    params.subject_ids.push(oSubjects.fnGetData(row).subject_id);
                });

                $.post(action("service_acl_subjects_remove"), params, function(response) {
                    oSubjects.fnClearTable();
                    oSubjects.fnAddData(response.data);
                    enableActions();
                });
            });

        });

        $("#service_acl_subjects_remove_all").click(function() {
            var service = $("#service_acl_dialog #service option:selected");
            var params = {
                client_id: $("#details_client_id").val(),
                service_code: service.val()
            };

            confirm("clients.service_acl_dialog.remove_all_confirm", null,
                    function() {
                $.post(action("service_acl_subjects_remove"), params,
                       function(response) {
                    oSubjects.fnClearTable();
                    oSubjects.fnAddData(response.data);
                    enableActions();
                });
            });
        });
    }

    $(document).ready(function() {
        initServiceAclDialogs();
        initServiceAclSubjectsTable();
        initServiceAclActions();
        enableActions();
    });

    ACL.openDialog = function(serviceCode) {
        var params = {
            client_id: $("#details_client_id").val()
        };

        $.get(action("acl_services"), params, function(response) {
            var serviceSelect = $("#service_acl_dialog #service").html("");

            $.each(response.data, function(idx, val) {
                serviceSelect.append(
                    "<option value='" + val.service_code + "'>"
                        + val.service_code + "</option>");

                $("option:last", serviceSelect).data("title", val.title);
            });

            $("#service_acl_dialog #service").val(serviceCode).change();
        }, "json");
    };

}(window.ACL = window.ACL || {}, jQuery));