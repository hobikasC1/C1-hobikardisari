<?php
/**
 * Plugin Name: Hobikardisari Standings
 * Description: Displays karting standings and results from Supabase.
 * Version:     1.0.0
 * Author:      Corner 1
 *
 * Shortcodes available:
 *   [hks_calendar]              — Season schedule
 *   [hks_standings class="Junior"]  — Driver standings (Junior | Standard | Heavy)
 *   [hks_team_standings]        — Team standings
 *   [hks_latest_results]        — Final results from last published event
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// ============================================================
// Configuration — paste your ANON (publishable) key only.
// NEVER use the service role key here.
// ============================================================
define( 'HKS_SUPABASE_URL',      'https://veamgodudcuzxnszbufi.supabase.co' );
define( 'HKS_SUPABASE_ANON_KEY', 'sb_publishable_lfKZcAEZ6Kck8c-MlLJBug_GaXX7Yy4' );


// ============================================================
// Shared helper — fetch a view from Supabase
// ============================================================
function hks_fetch( string $view, array $params = [] ): array {
    $url = HKS_SUPABASE_URL . '/rest/v1/' . $view . '?select=*';
    foreach ( $params as $key => $value ) {
        $url .= '&' . urlencode( $key ) . '=' . urlencode( $value );
    }

    $response = wp_remote_get( $url, [
        'headers' => [
            'apikey'        => HKS_SUPABASE_ANON_KEY,
            'Authorization' => 'Bearer ' . HKS_SUPABASE_ANON_KEY,
        ],
        'timeout' => 10,
    ] );

    if ( is_wp_error( $response ) ) return [];
    $body = wp_remote_retrieve_body( $response );
    $data = json_decode( $body, true );
    return is_array( $data ) ? $data : [];
}


// ============================================================
// Shared CSS (injected once)
// ============================================================
function hks_styles(): string {
    static $printed = false;
    if ( $printed ) return '';
    $printed = true;
    return '<style>
.hks-table { width:100%; border-collapse:collapse; font-size:14px; margin:16px 0; }
.hks-table th { background:#1a1a1a; color:#fff; padding:8px 10px; text-align:left; font-weight:600; }
.hks-table td { padding:7px 10px; border-bottom:1px solid #e5e7eb; }
.hks-table tr:hover td { background:#f9fafb; }
.hks-table .num { text-align:center; }
.hks-badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600; }
.hks-badge-upcoming  { background:#dbeafe; color:#1d4ed8; }
.hks-badge-completed { background:#d1fae5; color:#065f46; }
.hks-badge-published { background:#fef3c7; color:#92400e; }
.hks-badge-progress  { background:#fee2e2; color:#991b1b; }
.hks-rank-1 { font-weight:700; color:#b45309; }
.hks-rank-2 { font-weight:700; color:#6b7280; }
.hks-rank-3 { font-weight:700; color:#92400e; }
.hks-section-title { font-size:16px; font-weight:700; margin:24px 0 8px; }
</style>';
}


// ============================================================
// [hks_calendar]
// ============================================================
add_shortcode( 'hks_calendar', function() {
    $rows = hks_fetch( 'public_calendar' );
    if ( empty( $rows ) ) return '<p>Hooaja kalender pole veel saadaval.</p>';

    $status_labels = [
        'draft'       => [ 'Tulemas',   'upcoming'  ],
        'in_progress' => [ 'Käimas',    'progress'  ],
        'completed'   => [ 'Lõppenud',  'completed' ],
        'published'   => [ 'Avaldatud', 'published' ],
    ];

    $html  = hks_styles();
    $html .= '<table class="hks-table">';
    $html .= '<thead><tr>
        <th class="num">#</th>
        <th>Etapp</th>
        <th>Rada</th>
        <th>Kuupäev</th>
        <th>Staatus</th>
    </tr></thead><tbody>';

    foreach ( $rows as $row ) {
        $status = $row['status'] ?? 'draft';
        [ $label, $css ] = $status_labels[ $status ] ?? [ $status, 'upcoming' ];
        $date = ! empty( $row['event_date'] )
            ? date_i18n( 'j. F Y', strtotime( $row['event_date'] ) )
            : '–';

        $html .= sprintf(
            '<tr>
                <td class="num">%d</td>
                <td>%s</td>
                <td>%s</td>
                <td>%s</td>
                <td><span class="hks-badge hks-badge-%s">%s</span></td>
            </tr>',
            intval( $row['event_order'] ),
            esc_html( $row['event_name'] ?? '' ),
            esc_html( $row['venue'] ?? '–' ),
            esc_html( $date ),
            esc_attr( $css ),
            esc_html( $label )
        );
    }

    $html .= '</tbody></table>';
    return $html;
} );


// ============================================================
// [hks_standings class="Junior"]
// ============================================================
add_shortcode( 'hks_standings', function( $atts ) {
    $atts  = shortcode_atts( [ 'class' => 'Standard' ], $atts );
    $class = in_array( $atts['class'], [ 'Junior', 'Standard', 'Heavy' ], true )
        ? $atts['class'] : 'Standard';

    $rows = hks_fetch( 'public_driver_standings', [ 'class' => 'eq.' . $class ] );
    if ( empty( $rows ) ) return '<p>Tulemusi pole veel.</p>';

    // Collect event columns (unique, sorted)
    $events = [];
    foreach ( $rows as $r ) {
        $order = intval( $r['event_order'] );
        $events[ $order ] = 'E' . $order;
    }
    ksort( $events );

    // Pivot: driver → [ event_order → points ]
    $drivers = [];
    foreach ( $rows as $r ) {
        $id = $r['driver_id'];
        if ( ! isset( $drivers[ $id ] ) ) {
            $drivers[ $id ] = [
                'name'   => $r['driver_name'],
                'total'  => intval( $r['total_points'] ),
                'rank'   => intval( $r['class_rank'] ),
                'events' => [],
            ];
        }
        $drivers[ $id ]['events'][ intval( $r['event_order'] ) ] = intval( $r['event_points'] );
    }

    // Sort by rank
    usort( $drivers, fn( $a, $b ) => $a['rank'] - $b['rank'] );

    $rank_class = [ 1 => 'hks-rank-1', 2 => 'hks-rank-2', 3 => 'hks-rank-3' ];

    $html  = hks_styles();
    $html .= '<div class="hks-section-title">' . esc_html( $class ) . ' klass</div>';
    $html .= '<table class="hks-table"><thead><tr>';
    $html .= '<th class="num">#</th><th>Sõitja</th>';
    foreach ( $events as $order => $label ) {
        $html .= '<th class="num">' . esc_html( $label ) . '</th>';
    }
    $html .= '<th class="num">Kokku</th></tr></thead><tbody>';

    foreach ( $drivers as $d ) {
        $rc   = $rank_class[ $d['rank'] ] ?? '';
        $html .= '<tr>';
        $html .= '<td class="num ' . esc_attr( $rc ) . '">' . intval( $d['rank'] ) . '</td>';
        $html .= '<td class="' . esc_attr( $rc ) . '">' . esc_html( $d['name'] ) . '</td>';
        foreach ( $events as $order => $label ) {
            $pts  = $d['events'][ $order ] ?? '–';
            $html .= '<td class="num">' . ( is_int( $pts ) ? $pts : '–' ) . '</td>';
        }
        $html .= '<td class="num ' . esc_attr( $rc ) . '"><strong>' . intval( $d['total'] ) . '</strong></td>';
        $html .= '</tr>';
    }

    $html .= '</tbody></table>';
    return $html;
} );


// ============================================================
// [hks_team_standings]
// ============================================================
add_shortcode( 'hks_team_standings', function() {
    $rows = hks_fetch( 'public_team_standings' );
    if ( empty( $rows ) ) return '<p>Tiimide tulemusi pole veel.</p>';

    $events = [];
    foreach ( $rows as $r ) {
        $order = intval( $r['event_order'] );
        $events[ $order ] = 'E' . $order;
    }
    ksort( $events );

    $teams = [];
    foreach ( $rows as $r ) {
        $id = $r['team_id'];
        if ( ! isset( $teams[ $id ] ) ) {
            $teams[ $id ] = [
                'name'   => $r['team_name'],
                'total'  => intval( $r['total_points'] ),
                'rank'   => intval( $r['team_rank'] ),
                'events' => [],
            ];
        }
        $teams[ $id ]['events'][ intval( $r['event_order'] ) ] = intval( $r['event_points'] );
    }

    usort( $teams, fn( $a, $b ) => $a['rank'] - $b['rank'] );

    $rank_class = [ 1 => 'hks-rank-1', 2 => 'hks-rank-2', 3 => 'hks-rank-3' ];

    $html  = hks_styles();
    $html .= '<div class="hks-section-title">Tiimid</div>';
    $html .= '<table class="hks-table"><thead><tr>';
    $html .= '<th class="num">#</th><th>Tiim</th>';
    foreach ( $events as $order => $label ) {
        $html .= '<th class="num">' . esc_html( $label ) . '</th>';
    }
    $html .= '<th class="num">Kokku</th></tr></thead><tbody>';

    foreach ( $teams as $t ) {
        $rc   = $rank_class[ $t['rank'] ] ?? '';
        $html .= '<tr>';
        $html .= '<td class="num ' . esc_attr( $rc ) . '">' . intval( $t['rank'] ) . '</td>';
        $html .= '<td class="' . esc_attr( $rc ) . '">' . esc_html( $t['name'] ) . '</td>';
        foreach ( $events as $order => $label ) {
            $pts = $t['events'][ $order ] ?? '–';
            $html .= '<td class="num">' . ( is_int( $pts ) ? $pts : '–' ) . '</td>';
        }
        $html .= '<td class="num ' . esc_attr( $rc ) . '"><strong>' . intval( $t['total'] ) . '</strong></td>';
        $html .= '</tr>';
    }

    $html .= '</tbody></table>';
    return $html;
} );


// ============================================================
// [hks_latest_results]
// ============================================================
add_shortcode( 'hks_latest_results', function() {
    $rows = hks_fetch( 'public_latest_results' );
    if ( empty( $rows ) ) return '<p>Viimase etapi tulemused pole veel avaldatud.</p>';

    $event_name = $rows[0]['event_name'] ?? '';
    $event_date = ! empty( $rows[0]['event_date'] )
        ? date_i18n( 'j. F Y', strtotime( $rows[0]['event_date'] ) ) : '';

    // Group by session group_name
    $groups = [];
    foreach ( $rows as $r ) {
        $groups[ $r['group_name'] ][] = $r;
    }

    $html  = hks_styles();
    $html .= '<div class="hks-section-title">';
    $html .= esc_html( $event_name );
    if ( $event_date ) $html .= ' <span style="font-weight:400;color:#6b7280;">— ' . esc_html( $event_date ) . '</span>';
    $html .= '</div>';

    foreach ( $groups as $group_name => $results ) {
        $html .= '<div class="hks-section-title" style="font-size:14px;">Finaal ' . esc_html( $group_name ) . '</div>';
        $html .= '<table class="hks-table"><thead><tr>
            <th class="num">Koht</th>
            <th>Sõitja</th>
            <th>Klass</th>
            <th>Koguaeg</th>
            <th>Parim ring</th>
            <th>Märkused</th>
        </tr></thead><tbody>';

        foreach ( $results as $r ) {
            $html .= sprintf(
                '<tr>
                    <td class="num">%s</td>
                    <td>%s</td>
                    <td>%s</td>
                    <td>%s</td>
                    <td>%s</td>
                    <td style="color:#6b7280;font-size:12px;">%s</td>
                </tr>',
                esc_html( $r['position'] ?? '–' ),
                esc_html( $r['driver_name'] ?? '' ),
                esc_html( $r['class'] ?? '' ),
                esc_html( $r['total_time'] ?? '–' ),
                esc_html( $r['fastest_lap'] ?? '–' ),
                esc_html( $r['penalty_note'] ?? '' )
            );
        }

        $html .= '</tbody></table>';
    }

    return $html;
} );
